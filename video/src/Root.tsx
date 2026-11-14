import { Composition, Folder } from "remotion";
import { OrbitVideo } from "./OrbitVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Orbit">
      <Composition
        id="OrbitDemo"
        component={OrbitVideo}
        durationInFrames={960}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ music: "oldskool.mp3" }}
      />
      <Composition
        id="OrbitDemoSquare"
        component={OrbitVideo}
        durationInFrames={960}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{ music: "oldskool.mp3" }}
      />
    </Folder>
  );
};
