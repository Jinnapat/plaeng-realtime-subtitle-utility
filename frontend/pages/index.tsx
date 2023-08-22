import AppBar from "@/components/appbar";
import { Button, Center, Heading, Input, Stack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [name, setName] = useState("");

  return (
    <Stack h={"85vh"}>
      <AppBar />
      <Center h={"full"}>
        <Stack
          alignItems={"center"}
          spacing={10}
          backgroundColor={"white"}
          padding={"10"}
          borderRadius={"xl"}
        >
          <Heading size="md">Bring subtitle to real life</Heading>
          <Input
            bgColor={"white"}
            placeholder={"enter your name"}
            textAlign={"center"}
            onChange={(e) => {
              setName(e.currentTarget.value);
            }}
          ></Input>
          <Input
            bgColor={"white"}
            placeholder={"session id"}
            textAlign={"center"}
            onChange={(e) => {
              setSessionId(e.currentTarget.value);
            }}
          ></Input>
          <Stack w={"full"} minWidth={"150px"}>
            <Button
              isDisabled={name == ""}
              bgColor={"#ffc40c"}
              color={"white"}
              onClick={() => {
                router.push("/speaker?name=" + name);
              }}
            >
              Host a new session
            </Button>
            <Button
              isDisabled={name == "" || sessionId == ""}
              bgColor={"#ffc40c"}
              color={"white"}
              onClick={() => {
                router.push(
                  "/speaker?sessionId=" + sessionId + "&name=" + name
                );
              }}
            >
              Join a session
            </Button>
          </Stack>
        </Stack>
      </Center>
    </Stack>
  );
}
