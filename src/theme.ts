import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1DA1F2",
      light: "#71C9F8",
      dark: "#1A91DA",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#14171A",
      light: "#657786",
      dark: "#000000",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#FFFFFF",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#14171A",
      secondary: "#657786",
    },
    grey: {
      100: "#f5f8fa",
      200: "#e1e8ed",
      300: "#aab8c2",
    },
    divider: "rgba(0, 0, 0, 0.08)",
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          borderRadius: 16,
          border: "1px solid rgba(0, 0, 0, 0.08)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 20,
          padding: "8px 20px",
          fontWeight: 600,
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
        },
      },
    },
  },
  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h4: {
      fontWeight: 700,
      color: "#14171A",
    },
    h6: {
      fontWeight: 600,
      color: "#14171A",
    },
    subtitle1: {
      fontWeight: 500,
      color: "#14171A",
    },
    body1: {
      color: "#14171A",
    },
    body2: {
      color: "#657786",
    },
  },
});
