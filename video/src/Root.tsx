import { Composition, Folder } from "remotion";
import { OrbitVideo } from "./OrbitVideo";
import { OrbitV2Video } from "./OrbitV2Video";

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
      <Composition
        id="OrbitV2"
        component={OrbitV2Video}
        durationInFrames={1050}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ music: "shineblitz.mp3" }}
      />
      <Composition
        id="OrbitV2Square"
        component={OrbitV2Video}
        durationInFrames={1050}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{ music: "shineblitz.mp3" }}
      />
    </Folder>
  );
};
