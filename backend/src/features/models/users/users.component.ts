import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { get } from 'request';

import { NormalizedModel } from '../normalized-model.class';
import { requestOptions } from '../../../helpers/http.helper';
import { IUserWithId, IUserWithoutId } from './users.interface';

@WebSocketGateway()
export class UsersService extends NormalizedModel<IUserWithoutId>
  implements OnGatewayDisconnect {
  constructor() {
    super('userId');
  }

  @SubscribeMessage('CONNECT_USER')
  async connectUser(client, username: string) {
    const user = this.getUser(username);

    if (!!user) {
      this.setUserOnline(user);

      client.user = user;

      return { event: 'CONNECT_USER_SUCCESS', data: user };
    } else {
      const newUser = await this.addUser(username);

      client.user = newUser;

      this.setUserOnline(newUser);
      return { event: 'CONNECT_USER_SUCCESS', data: newUser };
    }
  }

  handleDisconnect(client: any) {
    if (!client.user) {
      return;
    }

    this.setUserOffline(client.user);

    if (this.getNbConnectionsUser(client.user) === 0) {
      return { event: 'DISCONNECT_USER_SUCCESS', data: client.user.id };
    }
  }

  getUser(username: string): IUserWithId {
    const user = this.ids
      .map(userId => this.entities[userId])
      .find(userTmp => userTmp.username === username);

    return user ? user : null;
  }

  getNbConnectionsUser(user: IUserWithId): number {
    if (!!this.entities[user.id]) {
      return this.entities[user.id].nbConnections;
    }

    return 0;
  }

  getNbConnections(): number {
    return this.ids.length;
  }

  addUser(username: string): Promise<IUserWithId> {
    return new Promise((resolve, reject) => {
      get(
        `https://api.github.com/users/${username}`,
        requestOptions,
        (error, response, body) => {
          const user: IUserWithoutId = {
            username,
            thumbnail: '',
            nbConnections: 0,
            isOnline: false,
          };

          if (!error) {
            try {
              body = JSON.parse(body);
              user.thumbnail = body.avatar_url || '';
            } catch (err) {}
          }

          const newUser = this.create(user);

          resolve(newUser);
        }
      );
    });
  }

  setUserOnline(user: IUserWithId): void {
    if (!this.entities[user.id]) {
      return;
    }

    this.entities[user.id].isOnline = true;
    this.entities[user.id].nbConnections++;
  }

  setUserOffline(user: IUserWithId): void {
    if (!this.entities[user.id]) {
      return;
    }

    this.entities[user.id].isOnline = false;
    this.entities[user.id].nbConnections--;
  }
}
