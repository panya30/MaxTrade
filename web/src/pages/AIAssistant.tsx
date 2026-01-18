/**
 * AI Assistant Page
 * Chat interface and sentiment analysis
 */

import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { useSentiment, useChat } from '../hooks/useApi';
import type { SentimentResult } from '../lib/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI trading assistant. I can help analyze market sentiment, explain trading signals, and answer questions about your portfolio.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sentimentText, setSentimentText] = useState('');
  const [sentimentResult, setSentimentResult] = useState<SentimentResult | null>(null);

  const sentiment = useSentiment();
  const chat = useChat();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const response = await chat.mutateAsync({ message: input });
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleAnalyzeSentiment = async () => {
    if (!sentimentText.trim()) return;

    const result = await sentiment.mutateAsync(sentimentText);
    setSentimentResult(result);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chat Interface */}
      <Card className="lg:col-span-2 flex flex-col h-[calc(100vh-12rem)]">
        <CardHeader title="Chat with AI" subtitle="Ask questions about trading and markets" />
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-bg-hover text-text'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs mt-1 opacity-60">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {chat.isPending && (
              <div className="flex justify-start">
                <div className="bg-bg-hover text-text rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce delay-100" />
                    <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSendMessage}
            className="p-4 border-t border-border flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about trading signals, market analysis..."
              className="flex-1 px-4 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" disabled={!input.trim() || chat.isPending}>
              Send
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sentiment Analysis */}
      <div className="space-y-6">
        <Card>
          <CardHeader title="Sentiment Analysis" subtitle="Analyze text sentiment" />
          <CardContent className="space-y-4">
            <textarea
              value={sentimentText}
              onChange={(e) => setSentimentText(e.target.value)}
              placeholder="Paste news headlines or social media text to analyze sentiment..."
              rows={4}
              className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              onClick={handleAnalyzeSentiment}
              loading={sentiment.isPending}
              fullWidth
            >
              Analyze Sentiment
            </Button>

            {sentimentResult && (
              <div className="mt-4 p-4 bg-bg-hover rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-muted">Sentiment</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      sentimentResult.label === 'positive'
                        ? 'bg-bull/20 text-bull'
                        : sentimentResult.label === 'negative'
                          ? 'bg-bear/20 text-bear'
                          : 'bg-warning/20 text-warning'
                    }`}
                  >
                    {sentimentResult.label.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Score</span>
                    <span className="text-text">
                      {sentimentResult.score.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Confidence</span>
                    <span className="text-text">
                      {(sentimentResult.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {sentimentResult.keyPhrases.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-text-muted mb-2">Key Phrases</p>
                    <div className="flex flex-wrap gap-2">
                      {sentimentResult.keyPhrases.map((phrase, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-bg-card text-xs text-text rounded"
                        >
                          {phrase}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader title="Quick Actions" />
          <CardContent className="space-y-2">
            {[
              "What's the market sentiment today?",
              'Analyze my portfolio performance',
              'Top momentum stocks this week',
              'Explain RSI indicator',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="w-full text-left px-3 py-2 text-sm text-text-muted hover:text-text hover:bg-bg-hover rounded-lg transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
