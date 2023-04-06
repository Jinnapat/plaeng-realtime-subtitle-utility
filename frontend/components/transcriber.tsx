/* eslint-disable react-hooks/rules-of-hooks */
import { colorTheme, speechToTextParameter } from "@/uitls/constants";
import { languageSpeechTags, speechToTranslate } from "@/uitls/language";
import { SocketConstant } from "@/uitls/socketUtil";
import { Stack, Heading, Button, Box, Select, Text, useDisclosure, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { io } from "socket.io-client";

const socket = io(SocketConstant.baseUrl || 'ws://localhost:8080',{
    transports: ['websocket'],
    autoConnect: false,
    rejectUnauthorized: false,
    path:'/socket.io/'
});


export function Transcriber(){
    const {
        transcript,
        resetTranscript,
        browserSupportsSpeechRecognition,
        isMicrophoneAvailable
    } = useSpeechRecognition();
    const [modalText, setModalText] = useState('');
    const [language, setLanaguage] = useState(languageSpeechTags[0].tag);
    const [listening, setListenning] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [finalTranscript, setFinalTranscript] = useState('');
    const timerId = useRef<any>(null);
    const { isOpen, onOpen, onClose } = useDisclosure()

    useEffect(()=>{
        if(transcript.trim() != ''){
            setFinalTranscript(transcript);
        }
        sendSpeech(transcript,language)
    },[transcript])

    useEffect(()=>{
        let resetTime = speechToTextParameter.speechGapMultiplier * finalTranscript.length;
        if(resetTime < 1000){
            resetTime = 1000
        }
        if(timerId.current !== null){
            clearTimeout(timerId.current);
        }
        timerId.current = setTimeout(()=>{
            setFinalTranscript('');
        },resetTime)
    },[finalTranscript])

    useEffect(()=>{
        if(sessionId == ''){
            socket.on('connect', ()=>{
                socket.emit('hostSession',(res: any)=>{
                    setSessionId(res)
                });
            })
            socket.connect();
        }
    },[])

    useEffect(()=>{
        if(!browserSupportsSpeechRecognition){
            setModalText("Your browser does not support speech recognition.")
            onOpen();
        }
        else if(!isMicrophoneAvailable){
            setModalText("Microphone access is not permitted.")
            onOpen();
        }
    },[isMicrophoneAvailable,browserSupportsSpeechRecognition])

    function onMessageEnd(event : any){

        SpeechRecognition.getRecognition()!.lang = language;
        SpeechRecognition.getRecognition()?.start();
    }

    function toggleListening(){
            if(listening){
                SpeechRecognition.getRecognition()!.onend = ()=>{
                }
                SpeechRecognition.getRecognition()?.abort();
                setListenning(false);
            }else{
                SpeechRecognition.getRecognition()!.lang = language;
                SpeechRecognition.getRecognition()?.start();
                setListenning(true);
                SpeechRecognition.getRecognition()!.onend = onMessageEnd
                SpeechRecognition.getRecognition()!.onspeechstart = ()=>{
                    resetTranscript();
                }
            }
    }

    function sendSpeech(speech : string, language : string){
        if(speech == ""){
            return;
        }
        socket.emit("hostSpeech",{
            speech : speech,
            language: speechToTranslate.get(language)
        })
    }

    return(
        <>
        <Modal  isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Modal Title</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {modalText}
          </ModalBody>

          <ModalFooter>
            <Button colorScheme='blue' mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
        </Modal>
        <Stack alignItems={'center'} spacing={8}>
            <Heading size='xl' color={colorTheme.primary}>Session #{sessionId}</Heading>
            <Box w={'30vw'}>
            <Text>Speech language</Text>
            <Select onChange={e=>{
                setLanaguage(e.target.value)
            }} bgColor='white' defaultValue={languageSpeechTags[0].tag}>
                {
                    languageSpeechTags.map(e=>{
                        return (<option value={e.tag} key={e.tag}>
                            {e.name}
                        </option>)
                    })
                }
            </Select>
            </Box>
            {
                <Button bgColor={colorTheme.primary} color = {"white"} onClick={toggleListening}>
                    {listening ? 'Stop listening' : 'Start listening'}
                </Button>
            }
            <Box h={'30vh'} w={'70vw'}>
                <Heading size={'lg'} color={colorTheme.primary} textAlign='center'>
                    {finalTranscript}
                </Heading>
            </Box>
            </Stack>
            </>
    )
}