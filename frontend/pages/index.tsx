import AppBar from "@/components/appbar";
import { colorTheme } from "@/uitls/constants";
import {
  Box,
  Button,
  Center,
  Heading,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useRef, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [name, setName] = useState("");

  return (
    <Stack h={"85vh"}>
      <AppBar />
      <Center h={"full"}>
        <Stack alignItems={"center"} spacing={10}>
          <Heading size="xl" color={colorTheme.primary}>
            Bring subtitle to real life
          </Heading>
          <Input
            bgColor={"white"}
            placeholder={"enter your name"}
            onChange={(e) => {
              setName(e.currentTarget.value);
            }}
          ></Input>
          <Input
            bgColor={"white"}
            placeholder={"session id"}
            onChange={(e) => {
              setSessionId(e.currentTarget.value);
            }}
          ></Input>
          <Stack w={"20vw"} minWidth={"150px"}>
            <Button
              isDisabled={name == "" || sessionId == ""}
              bgColor={colorTheme.primary}
              color={"white"}
              onClick={() => {
                router.push(
                  "/session?sessionId=" + sessionId + "&name=" + name
                );
              }}
            >
              Join session
            </Button>
            <Text fontSize="lg" textAlign="center" fontWeight={500}>
              or
            </Text>
            <Button
              isDisabled={name == ""}
              bgColor={colorTheme.primary}
              color={"white"}
              onClick={() => {
                router.push("/speaker?name=" + name);
              }}
            >
              Host new session
            </Button>
          </Stack>
        </Stack>
      </Center>
    </Stack>
  );
}
