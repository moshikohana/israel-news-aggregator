import { Composition } from "remotion";
import { ZooVideo, zooVideoMeta } from "./ZooVideo";

export const Root: React.FC = () => {
  return (
    <Composition
      id="ZooVideo"
      component={ZooVideo}
      durationInFrames={zooVideoMeta.durationInFrames}
      fps={zooVideoMeta.fps}
      width={zooVideoMeta.width}
      height={zooVideoMeta.height}
    />
  );
};
