import {createEndpoint, type MessageEndpoint, type SafeRpcArgument} from '@/index';

interface HostApi {
  getHostName(): string;
}

interface User {
  fullName(): string;
  onGreeting(message: string): void;
}

const endpoint = createEndpoint<HostApi>(self as unknown as MessageEndpoint);

endpoint.expose({
  async greet(user: SafeRpcArgument<User>) {
    const hostName = await endpoint.call.getHostName();
    const fullName = await user.fullName();
    const message = `${hostName} greets ${fullName}`;

    await user.onGreeting(message);

    return message;
  },
  createFormatter() {
    return (value: number) => `worker:${value}`;
  },
});
