"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, Send, Upload, Play, Pause, StopCircle } from 'lucide-react';
import axios from 'axios';
import { performTTS } from './speech-utils';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

type Message = {
  role: 'visitor' | 'consultant';
  content: string;
  audioUrl?: string;
};

type Question = {
  id: number;
  type: string;
  content: string;
  scoring_criteria: { [key: string]: number };
  answer?: string;
};

export default function RehabChatRoom() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'consultant',
      content: '您好，我是您的运动评估顾问，请问有什么可以帮您的吗？可以选择【MORSE问答】或【运动能力得分评估】，或者可以直接与我聊聊'
    }
  ]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [mode, setMode] = useState<'morse' | 'llm_chat' | 'upload'>('llm_chat');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === 'morse') {
      const startSession = async () => {
        try {
          const response = await axios.post('http://172.16.113.144:8086/start');
          const { question } = response.data;
          setCurrentQuestion(question);
          setMessages([{ role: 'consultant', content: question.content }]);
        } catch (error) {
          console.error('Error starting session:', error);
        }
      };
      startSession();
    }
    if (mode === 'upload') {
      setMessages([{ role: 'consultant', content: '请上传你的运动能力评估结果表' }])
    }
  }, [mode]);

  const handleSubmit = async (m: string) => {
    console.log(m);
    
    if (m === 'morse') {
      handleAnswerSubmit()
    } else {
      handleNormalSubmit()
    }
  }

  const handleAnswerSubmit = async () => {
    if (!inputText.trim() || !currentQuestion) return;

    setMessages(prev => [...prev, { role: 'visitor', content: inputText }]);
    setInputText('');
    try {
      const response = await axios.post('http://172.16.113.144:8086/answer', { answer: inputText });
      const { question, total_score } = response.data;

      if (question) {
        setCurrentQuestion(question);

        setMessages(prev => [...prev, { role: 'consultant', content: question.content }]);
        const audioURL = await performTTS(question.content)
        if (audioURL) {
          playAudio(audioURL)
        }
      } else if (total_score !== undefined) {
        setTotalScore(total_score);
        setMessages(prev => [...prev, { role: 'consultant', content: `总得分: ${total_score}` }]);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    }

    
  };


  const handleNormalSubmit = async () => {
    if (!inputText.trim()) return;

    setMessages(prev => [...prev, { role: 'visitor', content: inputText }]);
    setInputText('');
    try {
      const response = await axios.post('http://172.16.113.144:8086/api/llm_chat', { text: inputText });
      const { llm_response } = response.data;
      const audioUrl = await performTTS(llm_response);
      setMessages(prev => [...prev, { role: 'consultant', content: llm_response, audioUrl }]);
      if (audioUrl) {
        playAudio(audioUrl);
      }
    } catch (error) {
      console.error('Error in LLM chat:', error);
    }

  };

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音识别。请使用支持的浏览器，例如 Chrome。');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'zh-CN';
    recognitionRef.current.interimResults = false;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      alert('语音识别出错，请重试。');
    };

    recognitionRef.current.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('File uploaded:', file.name);

      setMessages(prev => [...prev, { role: 'visitor', content: '请帮我进行得分评估' }]);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post('http://172.16.113.144:8086/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('Response from server:', response.data);
        const { llm_response } = response.data;
        const audioUrl = await performTTS(llm_response);
        setMessages(prev => [...prev, { role: 'consultant', content: llm_response, audioUrl }]);
        if (audioUrl) {
          playAudio(audioUrl);
        }
      } catch (error) {
        console.error('Error in file upload:', error);
      }
    }
  };

  const playAudio = (audioUrl: string) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);
    setIsPlaying(true);
    audio.play();
    audio.onended = () => setIsPlaying(false);
  };

  const pauseAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (mode === 'morse') {
        handleAnswerSubmit();
      } else if (mode === 'llm_chat' || mode === 'upload') {
        handleNormalSubmit();
      }
      setInputText('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <Card className="w-full max-w-3xl mx-auto">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">老年人运动评估咨询系统</h1>
          <div className="flex justify-center mb-4">
            <Button onClick={() => setMode('morse')} className="mr-2">MORSE问答评估</Button>
            <Button onClick={() => setMode('upload')} className="mr-2">运动能力得分评估</Button>
          </div>
          <ScrollArea className="h-[400px] pr-4 mb-4" ref={scrollAreaRef}>
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'visitor' ? 'justify-end' : 'justify-start'} mb-4`}>
                <div className={`flex items-start ${message.role === 'visitor' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar className="w-10 h-10">
                    {message.role === 'visitor' ? (
                      <AvatarImage src="/images/user.png" alt="Visitor avatar" />
                    ) : (
                      <AvatarImage src="/images/doctor.png" alt="Consultant avatar" />
                    )}
                    <AvatarFallback>{message.role === 'visitor' ? 'V' : 'C'}</AvatarFallback>
                  </Avatar>
                  <div className={`mx-2 ${message.role === 'visitor' ? 'text-right' : 'text-left'}`}>
                    <div className={`rounded-lg p-2 mb-1 inline-block ${message.role === 'visitor' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
                      }`}>
                      {message.content}
                    </div>
                    {message.audioUrl && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => isPlaying ? pauseAudio() : playAudio(message.audioUrl!)}
                        aria-label={isPlaying ? "暂停音频" : "播放音频"}
                      >
                        {isPlaying && currentAudio?.src === message.audioUrl ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={endOfMessagesRef} />
          </ScrollArea>
          {totalScore !== null && mode === 'morse' && (
            <div className="mt-4">
              <p className="text-xl font-bold">总得分: {totalScore}</p>
            </div>
          )}
          <div className="flex items-center mt-4">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的问题..."
              className="flex-grow mr-2"
            />
            <Button onClick={handleVoiceInput} variant="outline" size="icon" className="mr-2" aria-label={isRecording ? "停止录音" : "开始录音"}>
              {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button onClick={() => handleSubmit(mode)}>
              <Send className="h-4 w-4 mr-2" />
              发送
            </Button>


            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="icon" className="mr-2" aria-label="上传文件">
              <Upload className="h-4 w-4" />
            </Button>


          </div>
        </CardContent>
      </Card>
    </div>
  );
}
