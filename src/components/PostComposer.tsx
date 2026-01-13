import React from 'react';
import { format } from 'date-fns';
import { Edit3 } from 'lucide-react';

interface PostComposerProps {
    text: string;
    setText: (text: string) => void;
}

export const PostComposer: React.FC<PostComposerProps> = ({ text, setText }) => {
    const MAX_CHARS = 280;
    const length = text.length;
    const remaining = MAX_CHARS - length;

    // Current time for preview context
    const currentTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Edit3 className="w-5 h-5" />
                    投稿本文
                </h2>
                <div className={`text-sm font-medium ${remaining < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    残り文字数: {remaining} / {MAX_CHARS}
                </div>
            </div>

            <div className="relative">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full h-48 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent resize-none font-sans text-base transition-shadow"
                    placeholder={`2025.11.15\n@ アメリカ村DROP\n\nちくわﾁｬﾝﾃﾞｽ(@husky_chikuwa)\n#ちくわﾁｬﾝﾃﾞｽ #husky (@husky_idol) #はすきーちゃん`}
                />
            </div>

            {/* Preview Area */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    プレビュー
                </div>
                <div className="p-4">
                    <div className="whitespace-pre-wrap text-gray-900 leading-relaxed">
                        {text || <span className="text-gray-400 italic">本文が入力されていません</span>}
                        <div className="mt-4 text-blue-600 font-medium bg-blue-50 inline-block px-2 py-1 rounded">
                            {currentTime} <span className="text-xs opacity-75">（投稿時に自動追加）</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
