"use client";

import * as React from "react";
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ModeToggle } from "@/components/mode-toggle";
import { Upload, Eraser, Save, Square, RectangleHorizontal, RectangleVertical, Sparkles, Tally1, Tally2, Tally3, Loader2, X, ScanEye, UploadCloud } from "lucide-react";

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

export type EditingFormData = {
  prompt: string;
  n: number;
  size: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  quality: "low" | "medium" | "high" | "auto";
  imageFiles: File[];
  maskFile: File | null;
};

type EditingFormProps = {
  onSubmit: (data: EditingFormData) => void;
  isLoading: boolean;
  currentMode: "generate" | "edit";
  onModeChange: (mode: "generate" | "edit") => void;
  imageFiles: File[];
  sourceImagePreviewUrls: string[];
  setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setSourceImagePreviewUrls: React.Dispatch<React.SetStateAction<string[]>>;
  maxImages: number;
  editPrompt: string;
  setEditPrompt: React.Dispatch<React.SetStateAction<string>>;
  editN: number[];
  setEditN: React.Dispatch<React.SetStateAction<number[]>>;
  editSize: EditingFormData['size'];
  setEditSize: React.Dispatch<React.SetStateAction<EditingFormData['size']>>;
  editQuality: EditingFormData['quality'];
  setEditQuality: React.Dispatch<React.SetStateAction<EditingFormData['quality']>>;
  editBrushSize: number[];
  setEditBrushSize: React.Dispatch<React.SetStateAction<number[]>>;
  editShowMaskEditor: boolean;
  setEditShowMaskEditor: React.Dispatch<React.SetStateAction<boolean>>;
  editGeneratedMaskFile: File | null;
  setEditGeneratedMaskFile: React.Dispatch<React.SetStateAction<File | null>>;
  editIsMaskSaved: boolean;
  setEditIsMaskSaved: React.Dispatch<React.SetStateAction<boolean>>;
  editOriginalImageSize: { width: number; height: number } | null;
  setEditOriginalImageSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
  editDrawnPoints: DrawnPoint[];
  setEditDrawnPoints: React.Dispatch<React.SetStateAction<DrawnPoint[]>>;
  editMaskPreviewUrl: string | null;
  setEditMaskPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
};


const RadioItemWithIcon = ({ value, id, label, Icon }: { value: string; id: string; label: string; Icon: React.ElementType }) => (
    <div className="flex items-center space-x-2">
        <RadioGroupItem value={value} id={id} className="border-white/40 data-[state=checked]:border-white text-white data-[state=checked]:text-white" />
        <Label htmlFor={id} className="flex items-center gap-2 cursor-pointer text-white/80 text-base">
            <Icon className="h-5 w-5 text-white/60" />
            {label}
        </Label>
    </div>
);


export function EditingForm({
    onSubmit,
    isLoading,
    currentMode,
    onModeChange,
    imageFiles,
    sourceImagePreviewUrls,
    setImageFiles,
    setSourceImagePreviewUrls,
    maxImages,
    editPrompt,
    setEditPrompt,
    editN,
    setEditN,
    editSize,
    setEditSize,
    editQuality,
    setEditQuality,
    editBrushSize,
    setEditBrushSize,
    editShowMaskEditor,
    setEditShowMaskEditor,
    editGeneratedMaskFile,
    setEditGeneratedMaskFile,
    editIsMaskSaved,
    setEditIsMaskSaved,
    editOriginalImageSize,
    setEditOriginalImageSize,
    editDrawnPoints,
    setEditDrawnPoints,
    editMaskPreviewUrl,
    setEditMaskPreviewUrl
}: EditingFormProps) {
  const [firstImagePreviewUrl, setFirstImagePreviewUrl] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dropZoneRef = React.useRef<HTMLLabelElement>(null);

  // Event handlers for drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const processFiles = (files: File[]) => {
    const totalFiles = imageFiles.length + files.length;
    if (totalFiles > maxImages) {
      alert(`You can only select up to ${maxImages} images.`);
      files = files.slice(0, maxImages - imageFiles.length);
      if (files.length === 0) return;
    }

    const validFiles = files.filter(file =>
      file.type === 'image/png' ||
      file.type === 'image/jpeg' ||
      file.type === 'image/webp'
    );

    if (validFiles.length === 0) return;

    setImageFiles(prevFiles => [...prevFiles, ...validFiles]);

    const filePromises = validFiles.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises)
      .then(newUrls => {
        setSourceImagePreviewUrls(prevUrls => [...prevUrls, ...newUrls]);
      })
      .catch(error => {
        console.error("Error reading image files:", error);
      });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  // Handle clipboard paste
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files.length) return;
      const pastedFiles = Array.from(e.clipboardData.files);
      processFiles(pastedFiles);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [imageFiles.length]);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const visualFeedbackCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDrawing = React.useRef(false);
  const lastPos = React.useRef<{ x: number; y: number } | null>(null);
  const maskInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editOriginalImageSize) {
      if (!visualFeedbackCanvasRef.current) {
        visualFeedbackCanvasRef.current = document.createElement('canvas');
      }
      visualFeedbackCanvasRef.current.width = editOriginalImageSize.width;
      visualFeedbackCanvasRef.current.height = editOriginalImageSize.height;
    }
  }, [editOriginalImageSize]);


  React.useEffect(() => {
    setEditGeneratedMaskFile(null);
    setEditIsMaskSaved(false);
    setEditOriginalImageSize(null);
    setFirstImagePreviewUrl(null);
    setEditDrawnPoints([]);
    setEditMaskPreviewUrl(null);

    if (imageFiles.length > 0 && sourceImagePreviewUrls.length > 0) {
        const img = new window.Image();
        img.onload = () => {
            setEditOriginalImageSize({ width: img.width, height: img.height });
        };
        img.src = sourceImagePreviewUrls[0];
        setFirstImagePreviewUrl(sourceImagePreviewUrls[0]);
    } else {
        setEditShowMaskEditor(false);
    }
  }, [imageFiles, sourceImagePreviewUrls, setEditGeneratedMaskFile, setEditIsMaskSaved, setEditOriginalImageSize, setEditDrawnPoints, setEditMaskPreviewUrl, setEditShowMaskEditor]);

  React.useEffect(() => {
    const displayCtx = canvasRef.current?.getContext('2d');
    const displayCanvas = canvasRef.current;
    const feedbackCanvas = visualFeedbackCanvasRef.current;

    if (!displayCtx || !displayCanvas || !feedbackCanvas || !editOriginalImageSize) return;

    const feedbackCtx = feedbackCanvas.getContext('2d');
    if (!feedbackCtx) return;

    feedbackCtx.clearRect(0, 0, feedbackCanvas.width, feedbackCanvas.height);
    feedbackCtx.fillStyle = 'red';
    editDrawnPoints.forEach(point => {
        feedbackCtx.beginPath();
        feedbackCtx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
        feedbackCtx.fill();
    });

    displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    displayCtx.save();
    displayCtx.globalAlpha = 0.5;
    displayCtx.drawImage(feedbackCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    displayCtx.restore();

  }, [editDrawnPoints, editOriginalImageSize]);


  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const addPoint = (x: number, y: number) => {
      setEditDrawnPoints(prevPoints => [
          ...prevPoints,
          { x, y, size: editBrushSize[0] }
      ]);
      setEditIsMaskSaved(false);
      setEditMaskPreviewUrl(null);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const currentPos = getMousePos(e);
    if (!currentPos) return;
    lastPos.current = currentPos;
    addPoint(currentPos.x, currentPos.y);
  };

  const drawLine = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const currentPos = getMousePos(e);
    if (!currentPos || !lastPos.current) return;

    const dist = Math.hypot(currentPos.x - lastPos.current.x, currentPos.y - lastPos.current.y);
    const angle = Math.atan2(currentPos.y - lastPos.current.y, currentPos.x - lastPos.current.x);
    const step = Math.max(1, editBrushSize[0] / 4);

    for (let i = step; i < dist; i += step) {
        const x = lastPos.current.x + Math.cos(angle) * i;
        const y = lastPos.current.y + Math.sin(angle) * i;
        addPoint(x, y);
    }
    addPoint(currentPos.x, currentPos.y);

    lastPos.current = currentPos;
  };

   const drawMaskStroke = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number
  ) => {
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
  };


  const stopDrawing = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const handleClearMask = () => {
    setEditDrawnPoints([]);
    setEditGeneratedMaskFile(null);
    setEditIsMaskSaved(false);
    setEditMaskPreviewUrl(null);
  };

  const generateAndSaveMask = () => {
    if (!editOriginalImageSize || editDrawnPoints.length === 0) {
        setEditGeneratedMaskFile(null);
        setEditIsMaskSaved(false);
        setEditMaskPreviewUrl(null);
        return;
    };

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = editOriginalImageSize.width;
    offscreenCanvas.height = editOriginalImageSize.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    if (!offscreenCtx) return;

    offscreenCtx.fillStyle = '#000000';
    offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    offscreenCtx.globalCompositeOperation = 'destination-out';
    editDrawnPoints.forEach(point => {
        drawMaskStroke(offscreenCtx, point.x, point.y, point.size);
    });

    try {
        const dataUrl = offscreenCanvas.toDataURL('image/png');
        setEditMaskPreviewUrl(dataUrl);
    } catch (e) {
        console.error("Error generating mask preview data URL:", e);
        setEditMaskPreviewUrl(null);
    }

    offscreenCanvas.toBlob((blob) => {
      if (blob) {
        const maskFile = new File([blob], 'generated-mask.png', { type: 'image/png' });
        setEditGeneratedMaskFile(maskFile);
        setEditIsMaskSaved(true);
        console.log("Mask generated and saved to state:", maskFile);
      } else {
        console.error("Failed to generate mask blob.");
        setEditIsMaskSaved(false);
        setEditMaskPreviewUrl(null);
      }
    }, 'image/png');
  };


  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      const totalFiles = imageFiles.length + newFiles.length;

      if (totalFiles > maxImages) {
        alert(`You can only select up to ${maxImages} images.`);
        const allowedNewFiles = newFiles.slice(0, maxImages - imageFiles.length);
        if (allowedNewFiles.length === 0) {
            event.target.value = '';
            return;
        }
        newFiles.splice(allowedNewFiles.length);
      }

      setImageFiles(prevFiles => [...prevFiles, ...newFiles]);

      const newFilePromises = newFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      Promise.all(newFilePromises)
        .then(newUrls => {
          setSourceImagePreviewUrls(prevUrls => [...prevUrls, ...newUrls]);
        })
        .catch(error => {
          console.error("Error reading new image files:", error);
        });

      event.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImageFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    setSourceImagePreviewUrls(prevUrls => prevUrls.filter((_, index) => index !== indexToRemove));
  };

  const handleMaskFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !editOriginalImageSize) {
          event.target.value = '';
          return;
      }

      if (file.type !== 'image/png') {
          alert("Invalid file type. Please upload a PNG file for the mask.");
          event.target.value = '';
          return;
      }

      const reader = new FileReader();
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
          if (img.width !== editOriginalImageSize.width || img.height !== editOriginalImageSize.height) {
              alert(`Mask dimensions (${img.width}x${img.height}) must match the source image dimensions (${editOriginalImageSize.width}x${editOriginalImageSize.height}).`);
              URL.revokeObjectURL(objectUrl);
              event.target.value = '';
              return;
          }

          setEditGeneratedMaskFile(file);
          setEditIsMaskSaved(true);
          setEditDrawnPoints([]);

          reader.onloadend = () => {
              setEditMaskPreviewUrl(reader.result as string);
              URL.revokeObjectURL(objectUrl);
          };
          reader.onerror = () => {
              console.error("Error reading mask file for preview.");
              setEditMaskPreviewUrl(null);
              URL.revokeObjectURL(objectUrl);
          };
          reader.readAsDataURL(file);

          event.target.value = '';
      };

      img.onerror = () => {
          alert("Failed to load the uploaded mask image to check dimensions.");
          URL.revokeObjectURL(objectUrl);
          event.target.value = '';
      };

      img.src = objectUrl;
  };


  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (imageFiles.length === 0) {
      alert("Please select at least one image to edit.");
      return;
    }
    if (editDrawnPoints.length > 0 && !editGeneratedMaskFile && !editIsMaskSaved) {
        alert("Please save the mask you have drawn before submitting.");
        return;
    }

    const formData: EditingFormData = {
      prompt: editPrompt,
      n: editN[0],
      size: editSize,
      quality: editQuality,
      imageFiles: imageFiles,
      maskFile: editGeneratedMaskFile,
    };
    onSubmit(formData);
  };

  const displayFileNames = (files: File[]) => {
      if (files.length === 0) return "No file selected.";
      if (files.length === 1) return files[0].name;
      return `${files.length} files selected`;
  }

  return (
    <Card className="w-full h-full border border-white/10 bg-black overflow-hidden flex flex-col rounded-lg">
      <CardHeader className="pb-4 border-b border-white/10 flex justify-between items-start">
         <div>
            <CardTitle className="text-lg font-medium text-white">Edit Image</CardTitle>
            <CardDescription className="text-white/60 mt-1">
              Modify an image using gpt-image-1.
            </CardDescription>
         </div>
         <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 h-full overflow-hidden">
        <CardContent className="p-4 space-y-5 flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="edit-prompt" className="text-white">Prompt</Label>
            <Textarea
              id="edit-prompt"
              placeholder="e.g., Add a party hat to the main subject"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              required
              disabled={isLoading}
              className="min-h-[80px] bg-black border border-white/20 text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50 rounded-md"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Source Image(s) [Max: 10]</Label>
            <Label
                ref={dropZoneRef}
                htmlFor="image-files-input"
                className={`flex items-center justify-between w-full h-10 px-3 py-2 text-sm border rounded-md cursor-pointer bg-black transition-colors ${
                  isDragging ? 'border-white/50 bg-white/10' : 'border-white/20 hover:bg-white/5'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <span className="text-white/60 truncate pr-2">
                    {displayFileNames(imageFiles)}
                </span>
                <span className="flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-md text-xs font-medium bg-white/10 text-white/80 hover:bg-white/20">
                    <Upload className="h-3 w-3" /> Browse...
                </span>
            </Label>
            <Input
              id="image-files-input"
              type="file"
              accept="image/png, image/jpeg, image/webp"
              multiple
              onChange={handleImageFileChange}
              disabled={isLoading || imageFiles.length >= maxImages}
              className="sr-only"
            />
            {sourceImagePreviewUrls.length > 0 && (
                <div className="flex space-x-2 pt-2 overflow-x-auto">
                    {sourceImagePreviewUrls.map((url, index) => (
                        <div key={url} className="relative shrink-0">
                            <Image
                                src={url}
                                alt={`Source preview ${index + 1}`}
                                width={80}
                                height={80}
                                className="object-cover rounded border border-white/10"
                                unoptimized
                             />
                             <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-600 hover:bg-red-700 text-white p-0.5 transform translate-x-1/3 -translate-y-1/3"
                                onClick={() => handleRemoveImage(index)}
                                aria-label={`Remove image ${index + 1}`}
                             >
                                <X className="h-3 w-3" />
                             </Button>
                        </div>
                    ))}
                </div>
            )}
          </div>

          <div className="space-y-3">
             <Label className="text-white block">Mask</Label>
             <Button
                 type="button"
                 variant="outline"
                 size="sm"
                 onClick={() => setEditShowMaskEditor(!editShowMaskEditor)}
                 disabled={isLoading || !editOriginalImageSize}
                 className="text-white/80 border-white/20 hover:bg-white/10 hover:text-white w-full justify-start px-3"
             >
                 {editShowMaskEditor ? 'Close Mask Editor' : (editGeneratedMaskFile ? 'Edit Saved Mask' : 'Create Mask')}
                 {editIsMaskSaved && !editShowMaskEditor && <span className="ml-auto text-green-400 text-xs">(Saved)</span>}
                 <ScanEye className="mt-0.5" />
             </Button>

             {editShowMaskEditor && firstImagePreviewUrl && editOriginalImageSize && (
                <div className="space-y-3 p-3 border border-white/20 rounded-md bg-black">
                    <p className="text-xs text-white/60">Draw on the image below to mark areas for editing (drawn areas become transparent in the mask).</p>
                    <div className="relative w-full mx-auto border border-white/10 rounded overflow-hidden" style={{ maxWidth: `min(100%, ${editOriginalImageSize.width}px)`, aspectRatio: `${editOriginalImageSize.width} / ${editOriginalImageSize.height}` }}>
                        <Image
                            src={firstImagePreviewUrl}
                            alt="Image preview for masking"
                            width={editOriginalImageSize.width}
                            height={editOriginalImageSize.height}
                            className="block w-full h-auto"
                            unoptimized
                         />
                        <canvas
                            ref={canvasRef}
                            width={editOriginalImageSize.width}
                            height={editOriginalImageSize.height}
                            className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                            onMouseDown={startDrawing}
                            onMouseMove={drawLine}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={drawLine}
                            onTouchEnd={stopDrawing}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="brush-size-slider" className="text-white text-sm">Brush Size: {editBrushSize[0]}px</Label>
                            <Slider
                                id="brush-size-slider"
                                min={5}
                                max={100}
                                step={1}
                                value={editBrushSize}
                                onValueChange={setEditBrushSize}
                                disabled={isLoading}
                                className="[&>span:first-child]:h-1 [&>span:first-child>span]:bg-white [&>button]:bg-white [&>button]:border-black [&>button]:ring-offset-black mt-1"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center gap-2 pt-3">
                         <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => maskInputRef.current?.click()}
                            disabled={isLoading || !editOriginalImageSize}
                            className="text-white/80 border-white/20 hover:bg-white/10 hover:text-white mr-auto"
                         >
                            <UploadCloud className="h-4 w-4 mr-1.5" /> Upload Mask
                         </Button>
                         <Input
                            ref={maskInputRef}
                            id="mask-file-input"
                            type="file"
                            accept="image/png"
                            onChange={handleMaskFileChange}
                            className="sr-only"
                         />
                         <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={handleClearMask} disabled={isLoading} className="text-white/80 border-white/20 hover:bg-white/10 hover:text-white">
                               <Eraser className="h-4 w-4 mr-1.5" /> Clear
                            </Button>
                            <Button type="button" variant="default" size="sm" onClick={generateAndSaveMask} disabled={isLoading || editDrawnPoints.length === 0} className="bg-white text-black hover:bg-white/90 disabled:opacity-50">
                               <Save className="h-4 w-4 mr-1.5" /> Save Mask
                            </Button>
                         </div>
                    </div>
                     {editMaskPreviewUrl && (
                        <div className="pt-3 border-t border-white/10 mt-3 text-center">
                            <Label className="text-white text-sm block mb-1.5">Generated Mask Preview:</Label>
                            <div className="bg-white p-1 inline-block rounded border border-gray-300">
                                <Image
                                    src={editMaskPreviewUrl}
                                    alt="Generated mask preview"
                                    width={0}
                                    height={134}
                                    className="max-w-full block"
                                    style={{ width: 'auto', height: '134px' }}
                                    unoptimized
                                />
                            </div>
                        </div>
                     )}
                     {editIsMaskSaved && !editMaskPreviewUrl && <p className="text-xs text-yellow-400 text-center pt-1">Generating mask preview...</p>}
                     {editIsMaskSaved && editMaskPreviewUrl && <p className="text-xs text-green-400 text-center pt-1">Mask saved successfully!</p>}
                </div>
             )}
             {!editShowMaskEditor && editGeneratedMaskFile && (
                 <p className="text-xs text-green-400 pt-1">Mask applied: {editGeneratedMaskFile.name}</p>
             )}
          </div>


          <div className="space-y-3">
            <Label className="text-white block">Size</Label>
            <RadioGroup
                value={editSize}
                onValueChange={(value) => setEditSize(value as EditingFormData['size'])}
                disabled={isLoading}
                className="flex flex-wrap gap-x-5 gap-y-3"
            >
                <RadioItemWithIcon value="auto" id="edit-size-auto" label="Auto" Icon={Sparkles} />
                <RadioItemWithIcon value="1024x1024" id="edit-size-square" label="Square" Icon={Square} />
                <RadioItemWithIcon value="1536x1024" id="edit-size-landscape" label="Landscape" Icon={RectangleHorizontal} />
                <RadioItemWithIcon value="1024x1536" id="edit-size-portrait" label="Portrait" Icon={RectangleVertical} />
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-white block">Quality</Label>
             <RadioGroup
                value={editQuality}
                onValueChange={(value) => setEditQuality(value as EditingFormData['quality'])}
                disabled={isLoading}
                className="flex flex-wrap gap-x-5 gap-y-3"
            >
                <RadioItemWithIcon value="auto" id="edit-quality-auto" label="Auto" Icon={Sparkles} />
                <RadioItemWithIcon value="low" id="edit-quality-low" label="Low" Icon={Tally1} />
                <RadioItemWithIcon value="medium" id="edit-quality-medium" label="Medium" Icon={Tally2} />
                <RadioItemWithIcon value="high" id="edit-quality-high" label="High" Icon={Tally3} />
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-n-slider" className="text-white">Number of Images: {editN[0]}</Label>
            <Slider
              id="edit-n-slider"
              min={1}
              max={10}
              step={1}
              value={editN}
              onValueChange={setEditN}
              disabled={isLoading}
              className="[&>span:first-child]:h-1 [&>span:first-child>span]:bg-white [&>button]:bg-white [&>button]:border-black [&>button]:ring-offset-black mt-3"
            />
          </div>

        </CardContent>
        <CardFooter className="p-4 border-t border-white/10">
          <Button type="submit" disabled={isLoading || !editPrompt || imageFiles.length === 0} className="w-full bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40 rounded-md flex items-center justify-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? "Editing..." : "Edit Image"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
