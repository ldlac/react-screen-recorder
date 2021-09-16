import React, { createContext, useContext, useEffect, useState } from "react";

export type SR = {
  blob: Blob | null;
  blobUrl: string | null;
  error: any;
  pauseRecording: () => void;
  resetRecording: () => void;
  resumeRecording: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  status: Status;
  isIdle: boolean;
  isRecording: boolean;
  isPaused: boolean;
  isStopped: boolean;
  isError: boolean;
};

export type ScreenRecorderProviderProps = {
  children: React.ReactElement;
  options?: MediaRecorderOptions;
  audio?: boolean;
};

const ScreenRecorderContext = createContext<SR | undefined>(undefined);

export type Status = "recording" | "idle" | "error" | "stopped" | "paused";

export interface StartRecordingOptions {
  useLastDevice: boolean;
  delay?: number;
}

export const PERMISSION_DENIED_ERROR = "Permission denied";

async function requestMediaStream(
  audio: boolean,
  options?: MediaRecorderOptions
): Promise<MediaRecorder> {
  const displayMedia = await navigator.mediaDevices.getDisplayMedia();

  let tracks = [...displayMedia.getTracks()];

  if (audio) {
    const userMedia = await navigator.mediaDevices.getUserMedia({ audio });
    tracks = [...tracks, ...userMedia.getTracks()];
  }

  const stream: MediaStream = new MediaStream(tracks);
  const mediaRecorder = new MediaRecorder(stream, options);

  return mediaRecorder;
}

export function ScreenRecorderProvider({
  children,
  options,
  audio = false,
}: ScreenRecorderProviderProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<any>();
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>();
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (mediaRecorder) {
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        const url = window.URL.createObjectURL(event.data);
        setBlobUrl(url);
        setBlob(event.data);
      };
    }
  }, [mediaRecorder]);

  const startRecording = async (
    { useLastDevice, delay }: StartRecordingOptions = {
      useLastDevice: false,
      delay: 200,
    }
  ) => {
    async function getNewMediaRecorder() {
      try {
        const recorder = await requestMediaStream(audio, options);
        setMediaRecorder(recorder);
        return recorder;
      } catch (e) {
        const error = e as DOMException;

        if (error?.message === PERMISSION_DENIED_ERROR) {
          // Permission denied is thrown on cancel
        } else {
          setError(e);
          setStatus("error");
        }

        return undefined;
      }
    }

    const mr =
      mediaRecorder && useLastDevice
        ? mediaRecorder
        : await getNewMediaRecorder();
    if (mr) {
      setTimeout(() => {
        mr.start();
        setStatus("recording");
      }, delay);
    }
  };

  const stopRecording = () => {
    isMediaRecorderDefined((mr) => {
      mr.stream.getTracks().forEach((track) => {
        track.stop();
      });
      mr.stop();

      setStatus("stopped");
    });
  };

  const pauseRecording = () => {
    isMediaRecorderDefined((mr) => {
      mr.pause();
      setStatus("paused");
    });
  };

  const resumeRecording = () => {
    isMediaRecorderDefined((mr) => {
      mr.resume();
      setStatus("recording");
    });
  };

  const isMediaRecorderDefined = (action: (mr: MediaRecorder) => void) => {
    if (!mediaRecorder) throw Error("No media stream!");
    action(mediaRecorder);
  };

  const resetRecording = () => {
    setBlobUrl(null);
    setError(null);
    setMediaRecorder(null);
    setStatus("idle");
  };

  return (
    <ScreenRecorderContext.Provider
      value={{
        blob,
        blobUrl,
        error,
        pauseRecording,
        resetRecording,
        resumeRecording,
        startRecording,
        status,
        stopRecording,
        isIdle: status === "idle",
        isRecording: status === "recording",
        isPaused: status === "paused",
        isStopped: status === "stopped",
        isError: status === "error",
      }}
    >
      {children}
    </ScreenRecorderContext.Provider>
  );
}

export function useScreenRecorder() {
  const context = useContext(ScreenRecorderContext);

  if (context === undefined) {
    throw new Error(
      "useScreenRecorder must be used within a ScreenRecorderContext"
    );
  }

  return { ...context };
}
