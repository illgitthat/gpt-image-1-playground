"use client";

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Download, Video } from 'lucide-react';
import * as React from 'react';

export type VideoInfo = {
    path: string;
    filename: string;
};

type VideoOutputProps = {
    videoBatch: VideoInfo[] | null;
    viewIndex: number;
    onViewChange: (index: number) => void;
    isLoading: boolean;
};

export function VideoOutput({ videoBatch, viewIndex, onViewChange, isLoading }: VideoOutputProps) {
    const activeVideo = videoBatch && videoBatch[viewIndex] ? videoBatch[viewIndex] : null;

    return (
        <div className='flex h-full min-h-[300px] w-full flex-col gap-4 overflow-hidden rounded-lg border border-white/20 bg-black p-4'>
            <div className='relative flex h-full w-full flex-grow items-center justify-center overflow-hidden'>
                {isLoading ? (
                    <div className='flex flex-col items-center justify-center text-white/60'>
                        <Loader2 className='mb-2 h-8 w-8 animate-spin' />
                        <p>Rendering video...</p>
                    </div>
                ) : activeVideo ? (
                    <video
                        key={activeVideo.filename}
                        src={activeVideo.path}
                        controls
                        className='max-h-full w-full max-w-full rounded-md border border-white/10 bg-black'
                    />
                ) : (
                    <div className='text-center text-white/40'>
                        <p>Your generated video will appear here.</p>
                    </div>
                )}
            </div>

            {videoBatch && videoBatch.length > 1 && (
                <div className='flex flex-wrap items-center justify-center gap-2'>
                    {videoBatch.map((vid, index) => (
                        <Button
                            key={vid.filename}
                            variant='ghost'
                            size='sm'
                            className={cn(
                                'h-9 gap-1 rounded-full border border-white/20 text-xs text-white/80 hover:bg-white/10 hover:text-white',
                                viewIndex === index ? 'bg-white/20 text-white' : ''
                            )}
                            onClick={() => onViewChange(index)}>
                            <Video className='h-4 w-4' />
                            {index + 1}
                        </Button>
                    ))}
                </div>
            )}

            {activeVideo && (
                <div className='flex justify-end'>
                    <a
                        href={activeVideo.path}
                        download={activeVideo.filename}
                        className='inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white'>
                        <Download className='h-4 w-4' />
                        Download MP4
                    </a>
                </div>
            )}
        </div>
    );
}
