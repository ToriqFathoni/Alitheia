import { Suspense } from "react";
import BrutalistNavbar from "../components/BrutalistNavbar";
import BrutalistHistory from "../components/BrutalistHistory";
import LoadingScreen from "../components/LoadingScreen";

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <>
          <BrutalistNavbar />
          <LoadingScreen />
        </>
      }
    >
      <BrutalistHistory />
    </Suspense>
  );
}
