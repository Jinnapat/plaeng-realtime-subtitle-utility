/* eslint-disable react-hooks/rules-of-hooks */
import { Spinner } from "@chakra-ui/react";
import { colorTheme, speechToTextParameter } from "@/uitls/constants";
import {
  defaultTranslateLanguage,
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
  const [processing, setProcessing] = useState(false);
  const [roomMembers, setRoomMembers] = useState<string[]>([]);

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
    let counter = sequenceRef.current;
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
    sequenceRef.current = counter;
  }

  useEffect(() => {
    if (!router.isReady) return;
    const query = new URLSearchParams(window.location.search);
    const inputSessionId = query.get("sessionId");
    const inputName = query.get("name");
    if (sessionId == "") {
      if (inputSessionId === null) {
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
            "joinSession",
            {
              language: defaultTranslateLanguage,
              sessionId: inputSessionId,
              name: inputName,
            },
            (res: any) => {
              if (res == true && inputSessionId !== null) {
                setSessionId(inputSessionId);
              }
            }
          );
        });
      }
      socket.on("user_left", (e: string) => {
        let targetIdx = roomMembers.findIndex((val) => val === e);
        setRoomMembers(roomMembers.filter((_, idx) => idx != targetIdx));
      });
      socket.on("user_joined", (e: string) => {
        console.log(e);
        setRoomMembers(roomMembers.concat([e]));
      });
      socket.on("subtitle", (e) => {
        transcriptContainer.current?.scrollIntoView({ behavior: "smooth" });
        if (sequenceRef.current == 0) {
          sequenceRef.current = e.seq + 1;
          if (e.isBreak) {
            setSubtitleHistory((old) => [...old, currentSubtitleRef.current]);
            setCurrentSubtitle("");
          } else {
            setCurrentSubtitle(e.speech);
          }
        } else {
          if (sequenceRef.current == e.seq) {
            if (e.isBreak) {
              setSubtitleHistory((old) => [...old, currentSubtitleRef.current]);
              setCurrentSubtitle("");
            } else {
              setCurrentSubtitle(e.speech);
            }
            fillGap();
          } else if (e.seq > sequenceRef.current) {
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
    setProcessing(false);
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
        setProcessing(true);
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
    await socket.emit("speech", {
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
      <Stack alignItems="center" spacing={5}>
        <Heading size="lg" color={"white"}>
          Session #{sessionId}
        </Heading>
        <Stack direction="row">
          <Box
            h="45vh"
            w="40vw"
            overflowX="hidden"
            overflowY="scroll"
            backgroundColor="white"
            padding="2"
            borderRadius="5"
          >
            <Heading size={"sm"} color={"#92989c"} textAlign="left">
              {subtitleHistory.map((s, id) => {
                return <div key={id}>{s}</div>;
              })}
            </Heading>
            <Heading size={"sm"} color={colorTheme.primary} textAlign="left">
              {currentSubtitle}
            </Heading>
            <div ref={transcriptContainer}></div>
          </Box>
          <Box
            h="45vh"
            w="200px"
            backgroundColor="white"
            padding="2"
            borderRadius="5"
          >
            <Text fontWeight={"bold"} fontSize={"md"}>
              Member list
            </Text>
            <Box
              border={"1px"}
              padding={"2"}
              height={"39vh"}
              overflowX={"hidden"}
              overflowY={"scroll"}
            >
              {roomMembers.map((memberName, idx) => (
                <Text key={idx} fontSize={"sm"}>
                  {memberName}
                </Text>
              ))}
            </Box>
          </Box>
        </Stack>
        <Box w="30vw">
          <Text color={"white"}>Speech language</Text>
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
          <Text color={"white"}>Subtitle language</Text>
          <Select
            onChange={(e) => {
              setSubtitleLanguage(e.target.value);
              socket.emit("changeLanguage", {
                sessionId: sessionId,
                language: e.target.value,
              });
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
        <Box>
          <Button
            bgColor={"#ffc40c"}
            color="white"
            onClick={toggleListening}
            mr="3"
          >
            {listening ? "Stop speaking" : "Start speaking"}
          </Button>
          <Button
            backgroundColor={"#9f1e00"}
            color={"white"}
            onClick={() => {
              socket.disconnect();
              router.push("/");
            }}
          >
            leave
          </Button>
        </Box>
        <Spinner fontSize="xl" hidden={!processing} color="white" />
      </Stack>
    </>
  );
}
