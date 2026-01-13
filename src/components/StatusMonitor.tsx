import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export interface PostGroup {
    id: string;
    images: string[]; // Grouped image IDs
    status: 'pending' | 'posting' | 'success' | 'failed';
    error?: string;
    retryCount: number;
}

interface StatusMonitorProps {
    groups: PostGroup[];
    isPosting: boolean;
    currentGroupIndex: number;
}

export const StatusMonitor: React.FC<StatusMonitorProps> = ({ groups, isPosting: _isPosting, currentGroupIndex: _currentGroupIndex }) => {
    // Use _ prefix for unused props that are kept for interface completeness or future use
    // Actually, we use groups. We don't use isPosting or currentGroupIndex directly in rendering logic below EXCEPT potential future expansion?
    // Wait, currentGroupIndex is not used in the JSX below?
    // Let's check logic. We map over groups. Highlight current?
    // We can highlight current group using index. 

    if (groups.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                待機中...
            </div>
        );
    }

    const successCount = groups.filter(g => g.status === 'success').length;
    const progress = Math.round((successCount / groups.length) * 100);

    return (
        <div className="space-y-4">
            {/* Progress Bar */}
            <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                    className="bg-blue-600 h-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="flex justify-between text-sm font-medium text-gray-600">
                <span>進行状況: {successCount} / {groups.length} グループ完了</span>
                <span>{progress}%</span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {groups.map((group, index) => (
                    <div
                        key={group.id}
                        className={`p-3 rounded-lg border text-sm flex items-center justify-between ${group.status === 'posting' ? 'bg-blue-50 border-blue-200' :
                                group.status === 'success' ? 'bg-green-50 border-green-200' :
                                    group.status === 'failed' ? 'bg-red-50 border-red-200' :
                                        'bg-gray-50 border-gray-200'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className={`font-semibold ${index === _currentGroupIndex && _isPosting ? 'text-blue-600' : 'text-gray-700'}`}>
                                グループ {index + 1}
                            </span>
                            <span className="text-gray-500 text-xs">({group.images.length}枚)</span>
                        </div>

                        <div className="flex items-center gap-2">
                            {group.status === 'posting' && (
                                <span className="flex items-center gap-1 text-blue-600">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    投稿中...
                                </span>
                            )}
                            {group.status === 'success' && (
                                <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle2 className="w-3 h-3" />
                                    成功
                                </span>
                            )}
                            {group.status === 'failed' && (
                                <div className="text-right">
                                    <span className="flex items-center gap-1 text-red-600">
                                        <AlertCircle className="w-3 h-3" />
                                        失敗
                                    </span>
                                    {group.error && <span className="text-xs text-red-500 block max-w-[150px] truncate">{group.error}</span>}
                                </div>
                            )}
                            {group.status === 'pending' && <span className="text-gray-400">待機中</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
