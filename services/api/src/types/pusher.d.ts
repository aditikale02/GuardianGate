declare module "pusher" {
  type TriggerData = Record<string, unknown>;

  export default class Pusher {
    constructor(options: {
      appId: string;
      key: string;
      secret: string;
      cluster: string;
      useTLS?: boolean;
    });

    trigger(channel: string, event: string, data: TriggerData): Promise<void>;
  }
}
