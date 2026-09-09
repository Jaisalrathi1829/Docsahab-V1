import { useState } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { LoginScreen } from "./screens/LoginScreen";
import { OtpScreen } from "./screens/OtpScreen";
import { PatientDetailsScreen } from "./screens/PatientDetailsScreen";

type Screen = "login" | "otp" | "details";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [phone, setPhone] = useState("");

  return (
    <PhoneFrame>
      {screen === "login" && (
        <LoginScreen
          onContinue={(p) => {
            setPhone(p);
            setScreen("otp");
          }}
        />
      )}

      {screen === "otp" && (
        <OtpScreen
          phone={phone}
          onBack={() => setScreen("login")}
          onVerify={() => setScreen("details")}
        />
      )}

      {screen === "details" && (
        <PatientDetailsScreen
          onBack={() => setScreen("otp")}
          onContinue={() => {
            /* Prototype end of flow — no screen follows Patient Details. */
          }}
        />
      )}
    </PhoneFrame>
  );
}
