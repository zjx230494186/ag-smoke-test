/**
 * SupabaseProvider — Bridges Y.js documents with Supabase Realtime Broadcast.
 *
 * Architecture:
 *   1. Each document has a Y.Doc shared across all participants.
 *   2. When a local Y.Doc update occurs, the binary diff is broadcast
 *      to all other connected clients via Supabase Realtime Broadcast channel.
 *   3. When a remote broadcast is received, the binary update is applied
 *      to the local Y.Doc, which TipTap's Collaboration extension picks up.
 *   4. Each client advertises its presence (cursor position, name, color)
 *      via Supabase Realtime Presence.
 */

import * as Y from 'yjs';
import { createClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Random color for each user's cursor
const CURSOR_COLORS = [
    '#f87171', '#fb923c', '#fbbf24', '#34d399', '#22d3ee',
    '#818cf8', '#a78bfa', '#f472b6', '#38bdf8', '#4ade80',
];

function randomColor() {
    return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

export interface AwarenessUser {
    name: string;
    color: string;
    clientId: number;
}

export class SupabaseProvider {
    doc: Y.Doc;
    channel: RealtimeChannel | null = null;
    awareness: Map<number, AwarenessUser> = new Map();
    onAwarenessChange?: (users: AwarenessUser[]) => void;

    private documentId: string;
    private localClientId: number;
    private userName: string;
    private userColor: string;
    private supabase = createClient();
    private destroyed = false;
    private initialSynced = false;

    constructor(documentId: string, doc: Y.Doc, userName: string) {
        this.documentId = documentId;
        this.doc = doc;
        this.localClientId = doc.clientID;
        this.userName = userName;
        this.userColor = randomColor();

        this.connect();
        this.setupDocListener();
    }

    private connect() {
        const channelName = `doc:${this.documentId}`;

        this.channel = this.supabase
            .channel(channelName, { config: { broadcast: { self: false } } })
            .on('broadcast', { event: 'yjs-update' }, (payload) => {
                if (this.destroyed) return;
                const { update, sender } = payload.payload as { update: number[]; sender: number };
                if (sender === this.localClientId) return;
                Y.applyUpdate(this.doc, new Uint8Array(update), 'remote');
            })
            .on('broadcast', { event: 'yjs-sync-request' }, () => {
                // When a new client joins, send them the full state
                if (this.destroyed) return;
                const state = Y.encodeStateAsUpdate(this.doc);
                this.channel?.send({
                    type: 'broadcast',
                    event: 'yjs-sync-response',
                    payload: { update: Array.from(state), sender: this.localClientId },
                });
            })
            .on('broadcast', { event: 'yjs-sync-response' }, (payload) => {
                if (this.destroyed || this.initialSynced) return;
                const { update } = payload.payload as { update: number[] };
                Y.applyUpdate(this.doc, new Uint8Array(update), 'remote');
                this.initialSynced = true;
            })
            .on('presence', { event: 'sync' }, () => {
                this.syncAwareness();
            })
            .on('presence', { event: 'join' }, () => {
                this.syncAwareness();
            })
            .on('presence', { event: 'leave' }, () => {
                this.syncAwareness();
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Track our presence
                    await this.channel?.track({
                        name: this.userName,
                        color: this.userColor,
                        clientId: this.localClientId,
                    });

                    // Request sync from existing clients
                    this.channel?.send({
                        type: 'broadcast',
                        event: 'yjs-sync-request',
                        payload: { sender: this.localClientId },
                    });
                }
            });
    }

    private setupDocListener() {
        this.doc.on('update', (update: Uint8Array, origin: unknown) => {
            if (this.destroyed || origin === 'remote') return;
            // Broadcast to other clients
            this.channel?.send({
                type: 'broadcast',
                event: 'yjs-update',
                payload: {
                    update: Array.from(update),
                    sender: this.localClientId,
                },
            });
        });
    }

    private syncAwareness() {
        if (!this.channel) return;
        const state = this.channel.presenceState<AwarenessUser>();
        const users: AwarenessUser[] = [];
        Object.values(state).forEach((presences) => {
            presences.forEach((p) => {
                users.push({
                    name: (p as unknown as AwarenessUser).name,
                    color: (p as unknown as AwarenessUser).color,
                    clientId: (p as unknown as AwarenessUser).clientId,
                });
            });
        });
        this.awareness = new Map(users.map(u => [u.clientId, u]));
        this.onAwarenessChange?.(users);
    }

    getLocalUser(): AwarenessUser {
        return { name: this.userName, color: this.userColor, clientId: this.localClientId };
    }

    destroy() {
        this.destroyed = true;
        this.channel?.untrack();
        this.channel?.unsubscribe();
        this.channel = null;
    }
}
