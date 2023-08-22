import { colorTheme } from "@/uitls/constants";
import { Box, Heading, Stack, Image } from "@chakra-ui/react";

export default function AppBar() {
  return (
    <Stack bgColor={colorTheme.primary}>
      <Box padding={"10px"} paddingBottom={"12px"}>
        <Heading size="lg" color={"white"}>
          Plæng
        </Heading>
      </Box>
    </Stack>
  );
}
