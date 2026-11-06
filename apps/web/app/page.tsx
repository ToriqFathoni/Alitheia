import { Suspense } from "react";
import BrutalistHome from "./components/BrutalistHome";
import LoadingScreen from "./components/LoadingScreen";

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BrutalistHome />
    </Suspense>
  );
}
