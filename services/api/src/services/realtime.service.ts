import Pusher from "pusher";
import { env } from "../config/env.config";

type RealtimePayload = Record<string, unknown>;

let pusherClient: Pusher | null = null;

const hasPusherConfig = () =>
  Boolean(
    env.PUSHER_APP_ID &&
      env.PUSHER_KEY &&
      env.PUSHER_SECRET &&
      env.PUSHER_CLUSTER,
  );

const getPusherClient = () => {
  if (!hasPusherConfig()) {
    return null;
  }

  if (!pusherClient) {
    pusherClient = new Pusher({
      appId: env.PUSHER_APP_ID!,
      key: env.PUSHER_KEY!,
      secret: env.PUSHER_SECRET!,
      cluster: env.PUSHER_CLUSTER!,
      useTLS: true,
    });
  }

  return pusherClient;
};

export const publishRealtimeEvent = async (
  channel: string,
  eventName: string,
  payload: RealtimePayload,
) => {
  const client = getPusherClient();
  if (!client) {
    return;
  }

  try {
    await client.trigger(channel, eventName, payload);
  } catch (error) {
    if (env.NODE_ENV !== "production") {
      console.error("Realtime publish failed:", error);
    }
  }
};
