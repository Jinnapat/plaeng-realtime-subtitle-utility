import AppBar from "@/components/appbar";
import { Participant } from "@/components/participant";
import { Stack, Center, Heading, Box, Button } from "@chakra-ui/react";

export default function Speaker() {
  return (
    <Stack h={"100vh"}>
      <AppBar />
      <Box>
        <Participant></Participant>
      </Box>
    </Stack>
  );
}
