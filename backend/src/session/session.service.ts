import { Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ChangeLanguageDto, Participant, Session } from './session.dto';

@Injectable()
export class SessionService {

    private sessions : Map<string,Session> = new Map<string,Session>(); // sessionId to Session Object
    private participantToSession : Map<string,string> = new Map<string,string>();
    private hostToSession : Map<string,string> = new Map<string,string>();

    async newSession(hostSocketId : string, subtitleLang: string){
        const sessionIdLength = 5;
        const newSessionId = await this.generateSessionId(sessionIdLength);
        const newSession = {
            hostSocketId : hostSocketId,
            subRoom: [],
            hostSubtitleLanguage: subtitleLang
        }
        this.sessions.set(newSessionId,newSession);
        this.hostToSession.set(hostSocketId,newSessionId);
        Logger.log(newSessionId + ", " + subtitleLang, "Session Created");
        return newSessionId;
    }

    async newSessionFixedId(hostSocketId: string, subtitleLang: string,sessionId : string){
        const newSession = {
            hostSocketId : hostSocketId,
            subRoom: [],
            hostSubtitleLanguage: subtitleLang
        }
        this.sessions.set(sessionId,newSession);
        this.hostToSession.set(hostSocketId,sessionId);
        Logger.log(sessionId + ", " + subtitleLang, "Session Created");
        return sessionId;
    }
    isHost(clientId: string){
        return this.hostToSession.has(clientId)
    }
    isParticipant(clientId: string){
        return this.participantToSession.has(clientId)
    }
    getSessionFromHostWsId(hostWsId: string){
        const sessionId = this.hostToSession.get(hostWsId);
        return this.sessions.get(sessionId);
    }
    getSessionFromParticipantWsId(participantWsId: string){
        const sessionId = this.participantToSession.get(participantWsId);
        return this.sessions.get(sessionId);
    }

    removeParticipant(clientId : string){
        return this.participantToSession.delete(clientId);
    }

    async joinSession(sessionId : string, user: Participant){
        if(!this.sessions.has(sessionId)){
            throw new WsException({message : "Session not found", status : 404})
        }else{
            const subRoomIdx = this.sessions.get(sessionId).subRoom.findIndex((sr)=>{
                return sr.language == user.language;
            })
            if(subRoomIdx === -1){
                this.sessions.get(sessionId).subRoom.push({
                    language: user.language,
                    participantsWSId: [user.socketId]
                })
            }else{
                this.sessions.get(sessionId).subRoom[subRoomIdx].participantsWSId.push(user.socketId);
            }
            this.participantToSession.set(user.socketId,sessionId);
            Logger.log(user.socketId + " joined session " + sessionId, "session join");
            return true;
        }
    }

    async changeLanguage(sessionId: string, user: Participant){
        if(!this.sessions.has(sessionId)){
            throw new WsException({message : "Session not found", status : 404})
        }
        for(let i = 0; i < this.sessions.get(sessionId).subRoom.length; i++){
            const userIdx = this.sessions.get(sessionId).subRoom[i].participantsWSId.findIndex((id)=>{
                return id == user.socketId;
            })
            if(userIdx !== -1){
                this.sessions.get(sessionId).subRoom[i].participantsWSId.splice(userIdx,1);
                const destSubRoom = this.sessions.get(sessionId).subRoom.findIndex((sr)=>{
                    return sr.language == user.language
                })
                if(destSubRoom !== -1){
                    this.sessions.get(sessionId).subRoom[destSubRoom].participantsWSId.push(user.socketId);
                }else{
                    this.sessions.get(sessionId).subRoom.push({
                        language: user.language,
                        participantsWSId: [user.socketId]
                    })
                }
                Logger.log('user "'+user.socketId+'" changed language to ' + user.language, "language changed");
                return;
            }
        }
        throw new WsException({message : "User is not in the session", status : 404})
    }

    async hostChangeLanguage(language: string,socketId :string){
        if(this.isHost(socketId)){
            const sessionId = this.hostToSession.get(socketId);
            this.sessions.get(sessionId).hostSubtitleLanguage = language;
            Logger.log("session " + sessionId +" to " + this.sessions.get(sessionId).hostSubtitleLanguage, "Host change language")
        }
        else{
            throw new WsException({message : "Host not found", status : 404})
        }
    }

    async removeUserFromSession(socketId: string){
        if(!this.participantToSession.has(socketId)){
            return;
        }
        const sessionId = this.participantToSession.get(socketId)
        for(let i = 0; i < this.sessions.get(sessionId).subRoom.length; i++){
            const userIdx = this.sessions.get(sessionId).subRoom[i].participantsWSId.findIndex(wsId=>{
                return wsId == socketId;
            })
            if(userIdx !== -1){
                this.sessions.get(sessionId).subRoom[i].participantsWSId.splice(userIdx,1);
                Logger.log( 'user "'+socketId+'" left session ' + sessionId, "session left");
                this.participantToSession.delete(socketId);
                return;
            }
        }
        throw new WsException({message : "User is not in the session", status : 404})
    }

    async hostEndSession(hostWsId : string){
        if(!this.hostToSession.has(hostWsId)){
            throw new WsException({message : "Host not found", status : 404})
        }
        const sessionId = this.hostToSession.get(hostWsId);
        Logger.log(sessionId, 'session end');
        this.sessions.delete(sessionId);
        this.hostToSession.delete(hostWsId)
    }

    generateSessionId(sessionIdLength : number){
        const number = "0123456789";
        let sessionId = "";
        let attemp = 0;
        while(true){
            attemp += 1;
            for (let i =0;i <sessionIdLength; i++){
                sessionId += number.charAt(Math.floor(Math.random() * number.length))
            }
            Logger.log("generating session id, attemp: " + attemp, 'Generate session Id');
            if(!this.sessions.has(sessionId)){
                break;
            } 
        }
        return sessionId;
    }
}
