import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const customConfig = defineConfig({
  globalCss: {
    body: {
      backgroundColor: "gray.50",
      color: "gray.900",
    },
  },
});

export const theme = createSystem(defaultConfig, customConfig);

export default theme;

