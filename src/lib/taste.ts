export const statuses = ["want_to_watch", "watching", "watched", "dropped"] as const;
export const statusLabels = { want_to_watch: "Want to watch", watching: "Watching", watched: "Watched", dropped: "Dropped" };
export const reactionLabels = ["Hated it", "Disliked it", "It was okay", "Liked it", "Loved it"] as const;
export const tags = ["boring", "interesting", "confusing", "rewatchable"] as const;
export type PersonalEntry = { status: typeof statuses[number]; reaction: number | null; tags: string[] };
export type ActionState = { ok: boolean; message: string };
