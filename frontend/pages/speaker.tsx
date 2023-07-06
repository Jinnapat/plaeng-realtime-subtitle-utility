import AppBar from "@/components/appbar";
import { Transcriber } from "@/components/transcriber";
import { Stack, Center, Heading, Box, Button } from "@chakra-ui/react";

export default function Speaker() {
  return (
    <Stack h="100vh">
      <AppBar />
      <Box>
        <Transcriber />
      </Box>
    </Stack>
  );
}
