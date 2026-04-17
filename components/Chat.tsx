import React, { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface ChatProps {
    socket: Socket | null;
    roomId: string;
    username: string;
}

export const Chat: React.FC<ChatProps> = ({ socket, roomId, username }) => {
    const [messages, setMessages] = useState<{user: string, text: string}[]>([]);
    const [input, setInput] = useState("");

    useEffect(() => {
        if (!socket) return;

        socket.on("chat-message", (data: {user: string, text: string}) => {
            setMessages(prev => [...prev.slice(-49), data]);
        });

        return () => {
            socket.off("chat-message");
        };
    }, [socket]);

    const sendMessage = () => {
        if (input.trim() && socket) {
            if (input.startsWith('/mic ')) {
                window.dispatchEvent(new CustomEvent('chat-command', { detail: { command: input.trim() } }));
                setMessages(prev => [...prev.slice(-49), { user: 'Sistema', text: `Comando ejecutado: ${input}` }]);
                setInput("");
                return;
            }
            socket.emit("chat-message", roomId, { user: username, text: input });
            setInput("");
        }
    };

    return (
        <div className="absolute bottom-40 left-4 w-64 h-48 bg-black/50 backdrop-blur-md rounded-lg p-2 flex flex-col z-50 border border-white/10 shadow-2xl">
            <div className="flex-1 overflow-y-auto text-xs text-white space-y-1 mb-2 scrollbar-hide">
                {messages.map((m, i) => (
                    <div key={i} className={`${m.user === 'Sistema' ? 'text-yellow-400 italic' : ''}`}>
                        <strong className={m.user === username ? 'text-blue-400' : 'text-green-400'}>{m.user}:</strong> {m.text}
                    </div>
                ))}
            </div>
            <div className="flex gap-1">
                <input 
                    className="flex-1 bg-white/10 text-white text-xs p-1 rounded"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} className="bg-blue-600 p-1 rounded"><Send size={12} /></button>
            </div>
        </div>
    );
};
