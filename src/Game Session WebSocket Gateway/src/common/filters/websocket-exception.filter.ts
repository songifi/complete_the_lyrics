import { Catch, ArgumentsHost } from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";

@Catch(WsException)
export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client: Socket = host.switchToWs().getClient();
    const error = exception.getError();

    client.emit("error", {
      success: false,
      error: typeof error === "string" ? error : error.toString(),
      timestamp: new Date(),
    });
  }
}
