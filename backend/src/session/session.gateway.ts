import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config/dist';
import {ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { OnGatewayDisconnect } from '@nestjs/websockets/interfaces';
import * as translate from 'translate-google';
import { Server, Socket } from 'socket.io';
import { ChangeLanguageDto, JoinSessionDto, SpeechDto } from './session.dto';
import { SessionService } from './session.service';

@WebSocketGateway({
  cors:{
    origin: '*',
  },
  transport:['websocket'],
})
export class SessionGateway implements OnGatewayDisconnect{

  @WebSocketServer()
  server : Server;
  
  constructor(private readonly sessionService: SessionService,
    private readonly configService: ConfigService) {
    
  }
  handleDisconnect(client: Socket) {
    if(this.sessionService.isHost(client.id)){
      const session = this.sessionService.getSessionFromHostWsId(client.id);
      session.subRoom.forEach(sr=>{
        sr.participantsWSId.forEach(wsId=>{
          this.server.to(wsId).emit("sessionEnd");
          this.sessionService.removeParticipant(wsId)
        })
      })
      return this.sessionService.hostEndSession(client.id);
    }
    else if(this.sessionService.isParticipant(client.id)){
      return this.sessionService.removeUserFromSession(client.id);
    }
  }

  @SubscribeMessage('hostSession')
  async createSession(
    @ConnectedSocket() host: Socket,
    @MessageBody() subtitleLang: string
  ){
    return await this.sessionService.newSession(host.id,subtitleLang)
  }

  @SubscribeMessage('joinSession')
  async joinSession(
    @MessageBody() dto : JoinSessionDto,
    @ConnectedSocket() client: Socket
  ){
    const joinSessionResult = await this.sessionService.joinSession(dto.sessionId,{
      language: dto.language,
      socketId: client.id,
      name: dto.name
    }, this.server);
    return joinSessionResult;
  }

  @SubscribeMessage('changeLanguage')
  async changeLanguage(
    @MessageBody() dto : ChangeLanguageDto,
    @ConnectedSocket() client: Socket
  ){
    return await this.sessionService.changeLanguage(dto.sessionId,{
      socketId: client.id,
      language: dto.language
    })
  }

  @SubscribeMessage('speech')
  async speech(
    @MessageBody() dto : SpeechDto,
    @ConnectedSocket() client: Socket
  ){
      Logger.log(dto.speech)
      const session = this.sessionService.isHost(client.id) ? this.sessionService.getSessionFromHostWsId(client.id) : this.sessionService.getSessionFromParticipantWsId(client.id);
      const hostId = session.hostSocketId;

      let speechToHost = '';
      if(dto.language == session.hostSubtitleLanguage  || dto.speech.trim() == "" || dto.isBreak){
        speechToHost = dto.isBreak ? '' : dto.speech;
      } else if (dto.speech !== null && dto.speech.trim() !== '') {
        try{
          speechToHost = await translate(dto.speech.toString(), {from : dto.language, to : session.hostSubtitleLanguage});
        } catch(err){
          Logger.error(err, "Translator error");
        }
      }
      this.server.to(hostId).emit("subtitle",{
        seq : dto.seq,
        speech : speechToHost,
        isBreak : dto.isBreak
      });
      // this.server.to(host.id)
      for (let j=0; j<session.subRoom.length; j++) {
        const sr = session.subRoom[j];
        const translated = {};
        for (let i = 0; i < sr.participantsWSId.length; i++) {
          
          const wsId = sr.participantsWSId[i];
          let speechToClient = "";
          
          if(dto.language == sr.language || dto.speech.trim() == "" || dto.isBreak) {
            speechToClient = dto.speech;
          } else if(dto.speech !== null && dto.speech.trim() !== '') {
            if (!translated[sr.language]) {
              try {
                translated[sr.language] = await translate(dto.speech.toString(), {from : dto.language, to : sr.language});
              } catch(err){
                Logger.error(err, "Translator error");
              }
            }
            speechToClient = translated[sr.language];
          }

          this.server.to(wsId).emit("subtitle",{
            seq : dto.seq,
            speech : speechToClient,
            isBreak : dto.isBreak
          });
        }
      }
  }
}
