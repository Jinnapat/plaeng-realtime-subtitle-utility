/* eslint-disable react-hooks/rules-of-hooks */
import { colorTheme, speechToTextParameter } from "@/uitls/constants";
import {
  languageSpeechTags,
  languageTranslateTag,
  speechToTranslate,
} from "@/uitls/language";
import { SocketConstant } from "@/uitls/socketUtil";
import {
  Stack,
  Heading,
  Button,
  Box,
  Select,
  Text,
  useDisclosure,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { io } from "socket.io-client";

const socket = io(SocketConstant.baseUrl || "ws://localhost:8080", {
  transports: ["websocket"],
  path: "/socket.io/",
  rejectUnauthorized: false,
  autoConnect: false,
  secure: true,
});

interface subtitleDto {
  speech: string;
  isBreak: boolean;
}

export function Transcriber() {
  const {
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
    transcript,
    resetTranscript,
  } = useSpeechRecognition();
  const [modalText, setModalText] = useState("");
  const [language, setLanaguage] = useState(languageSpeechTags[0].tag);
  const [subtitleLanguage, setSubtitleLanguage] = useState(
    languageTranslateTag[0].tag
  );
  const [listening, setListenning] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [subtitleHistory, setSubtitleHistory] = useState<string[]>([]);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const router = useRouter();

  const lastEmissionRef = useRef<any>();
  const languageRef = useRef<any>();
  const transcriptContainer = useRef<any>();
  const transcriptRef = useRef<any>();
  const subtitleHistoryRef = useRef<any>();
  const currentSubtitleRef = useRef<any>();
  const expectedSeqRef = useRef<number>(-1);
  const bufferRef = useRef<Map<number, subtitleDto>>(
    new Map<number, subtitleDto>()
  );
  const sequenceRef = useRef<any>(0);

  languageRef.current = language;
  lastEmissionRef.current = "";
  transcriptRef.current = transcript;
  subtitleHistoryRef.current = subtitleHistory;
  currentSubtitleRef.current = currentSubtitle;

  async function fillGap() {
    let counter = expectedSeqRef.current;
    counter = counter + 1;
    if (bufferRef.current.size > 0) {
      while (bufferRef.current.has(counter)) {
        const b = bufferRef.current.get(counter);
        if (b?.isBreak) {
          setSubtitleHistory((old) => [...old, b.speech]);
          setCurrentSubtitle("");
        } else {
          setCurrentSubtitle(b!.speech);
        }
        bufferRef.current.delete(counter);
        counter = counter + 1;
      }
    }
    expectedSeqRef.current = counter;
  }

  useEffect(() => {
    if (!router.isReady) return;
    const query = new URLSearchParams(window.location.search);
    const specialSid = query.get("special");
    if (sessionId == "") {
      if (specialSid === null) {
        socket.on("connect", () => {
          socket.emit(
            "hostSession",
            languageTranslateTag[0].tag,
            (res: any) => {
              setSessionId(res);
            }
          );
        });
      } else {
        socket.on("connect", () => {
          socket.emit(
            "hostSessionFixedId",
            {
              subtitleLang: languageTranslateTag[0].tag,
              sessionId: specialSid,
            },
            (res: any) => {
              setSessionId(res);
            }
          );
        });
      }
      socket.on("subtitle", (e) => {
        transcriptContainer.current?.scrollIntoView({ behavior: "smooth" });
        if (expectedSeqRef.current == -1) {
          expectedSeqRef.current = e.seq + 1;
          if (e.isBreak) {
            setSubtitleHistory((old) => [...old, currentSubtitleRef.current]);
            setCurrentSubtitle("");
          } else {
            setCurrentSubtitle(e.speech);
          }
        } else {
          if (expectedSeqRef.current == e.seq) {
            if (e.isBreak) {
              setSubtitleHistory((old) => [...old, currentSubtitleRef.current]);
              setCurrentSubtitle("");
            } else {
              setCurrentSubtitle(e.speech);
            }
            fillGap();
          } else if (e.seq > expectedSeqRef.current) {
            bufferRef.current.set(e.seq, {
              speech: e.speech,
              isBreak: e.isBreak,
            });
            fillGap();
          }
        }
      });
      socket.connect();
      setInterval(() => {
        if (
          transcriptRef.current.trim() != "" &&
          lastEmissionRef.current != transcriptRef.current
        ) {
          lastEmissionRef.current = transcriptRef.current;
          sendSpeech(transcriptRef.current, languageRef.current, false);
        }
      }, speechToTextParameter.emitInterval);
    }
  }, [router.isReady]);

  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      setModalText("Your browser does not support speech recognition.");
      onOpen();
    } else if (!isMicrophoneAvailable) {
      setModalText("Microphone access is not permitted.");
      onOpen();
    }
  }, [isMicrophoneAvailable, browserSupportsSpeechRecognition]);

  function onMessageEnd(event: any) {
    resetTranscript();
    lastEmissionRef.current = "";
    SpeechRecognition.getRecognition()!.lang = language;
    SpeechRecognition.getRecognition()?.start();
  }

  function toggleListening() {
    if (listening) {
      SpeechRecognition.getRecognition()!.onend = () => {};
      SpeechRecognition.getRecognition()?.abort();
      setListenning(false);
    } else {
      SpeechRecognition.getRecognition()!.continuous = false;
      SpeechRecognition.getRecognition()!.lang = language;
      SpeechRecognition.getRecognition()?.start();
      setListenning(true);
      SpeechRecognition.getRecognition()!.onend = onMessageEnd;
      SpeechRecognition.getRecognition()!.onspeechstart = () => {
        sendSpeech("break", languageRef.current, true);
      };
    }
  }

  async function sendSpeech(
    speech: string,
    language: string,
    isBreak: boolean
  ) {
    if (speech == "") {
      return;
    }
    await socket.emit("hostSpeech", {
      speech: speech,
      language: speechToTranslate.get(language),
      seq: sequenceRef.current,
      isBreak: isBreak,
    });
    sequenceRef.current = sequenceRef.current + 1;
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Error</ModalHeader>
          <ModalCloseButton />
          <ModalBody>{modalText}</ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Stack alignItems={"center"} spacing={5}>
        <Heading size="xl" color={colorTheme.primary}>
          Session #{sessionId}
        </Heading>
        <Box h={"30vh"} w={"70vw"} overflowX={"hidden"} overflowY={"scroll"}>
          <Heading size={"lg"} color={"#92989c"} textAlign="center">
            {/* {subtitleHistory.map((s,id)=>{
                        return (<div key={id}>{s}</div>);
                    })
                    }  */}
            <div>{subtitleHistory[subtitleHistory.length]}</div>
          </Heading>
          <Heading size={"lg"} color={colorTheme.primary} textAlign="center">
            {currentSubtitle}
          </Heading>
          <div ref={transcriptContainer}></div>
        </Box>
        <Box w={"30vw"}>
          <Text>Speech language</Text>
          <Select
            onChange={(e) => {
              setLanaguage(e.target.value);
            }}
            bgColor="white"
            defaultValue={languageSpeechTags[0].tag}
          >
            {languageSpeechTags.map((e) => {
              return (
                <option value={e.tag} key={e.tag}>
                  {e.name}
                </option>
              );
            })}
          </Select>
          <Text>Subtitle language</Text>
          <Select
            onChange={(e) => {
              setSubtitleLanguage(e.target.value);
              socket.emit("hostChangeLanguage", e.target.value);
            }}
            bgColor="white"
            defaultValue={languageTranslateTag[0].tag}
          >
            {languageTranslateTag.map((e) => {
              return (
                <option value={e.tag} key={e.tag}>
                  {e.name}
                </option>
              );
            })}
          </Select>
        </Box>
        {
          <Button
            bgColor={colorTheme.primary}
            color={"white"}
            onClick={toggleListening}
          >
            {listening ? "Stop listening" : "Start listening"}
          </Button>
        }
      </Stack>
    </>
  );
}
