import { colorTheme, speechToTextParameter } from "@/uitls/constants";
import {
  defaultTranslateLanguage,
  languageSpeechTags,
  languageTranslateTag,
} from "@/uitls/language";
import { RESTConstant } from "@/uitls/restUtil";
import { SocketConstant } from "@/uitls/socketUtil";
import { Stack, Heading, Select, Button, Box, Text } from "@chakra-ui/react";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
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

export function Participant() {
  const [language, setLanaguage] = useState(languageSpeechTags[0].tag);
  const [sessionId, setSessionId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>("");
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [subtitleHistory, setSubtitleHistory] = useState<string[]>([]);
  const router = useRouter();

  const transcriptContainer = useRef<any>();
  const subtitleHistoryRef = useRef<any>();
  const currentSubtitleRef = useRef<any>();
  const expectedSeqRef = useRef<number>(-1);
  const bufferRef = useRef<Map<number, subtitleDto>>(
    new Map<number, subtitleDto>()
  );

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
    const session = query.get("sessionId");
    socket.on("connect", () => {
      socket.emit(
        "joinSession",
        {
          language: defaultTranslateLanguage,
          sessionId: session,
        },
        (res: any) => {
          if (res == true && session !== null) {
            setErrorMessage("");
            setSessionId(session);
          }
        }
      );
    });
    socket.on("exception", (e) => {
      setErrorMessage(e.status + " : " + e.message);
    });
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
    socket.on("sessionEnd", (e) => {
      setErrorMessage("This session has ended");
    });
    socket.connect();
  }, [router.isReady]);

  return (
    <Stack alignItems="center" spacing={8}>
      <Heading size="xl" color={colorTheme.primary}>
        {errorMessage != "" ? errorMessage : "Session #" + sessionId}
      </Heading>
      <Box h="30vh" w="70vw" overflowX="hidden" overflowY="scroll">
        <Heading size="lg" color="#92989c" textAlign="center">
          {/* {subtitleHistory.map((s,id)=>{
                        return (<div key={id}>{s}</div>);
                    })
                    }  */}
          <div>{subtitleHistory[subtitleHistory.length]}</div>
        </Heading>
        <Heading size="lg" color={colorTheme.primary} textAlign="center">
          {currentSubtitle}
        </Heading>
        <div ref={transcriptContainer}></div>
      </Box>
      <Box w="30vw">
        <Text>Subtitle language</Text>
        <Select
          onChange={(e) => {
            setLanaguage(e.target.value);
            socket.emit("changeLanguage", {
              language: e.target.value,
              sessionId: sessionId,
            });
          }}
          defaultValue={languageSpeechTags[0].tag}
          bgColor="white"
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
    </Stack>
  );
}
