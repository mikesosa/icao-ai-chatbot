'use client';

import { useState } from 'react';

import Image from 'next/image';

import { Eye, Image as ImageIcon, ZoomIn } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ImageDisplayProps {
  title?: string;
  description?: string;
  images: Array<{
    url: string;
    alt: string;
    caption?: string;
  }>;
  className?: string;
  imageSetId?: string;
  isExamImage?: boolean;
  isCompleted?: boolean;
  onComplete?: () => void;
  subsection?: string;
  layout?: 'single' | 'side-by-side' | 'stacked';
  instructions?: string[];
}

// Utility function to add cache-busting parameters to image URLs
const addCacheBusting = (url: string): string => {
  const urlObj = new URL(url);
  // Add timestamp-based cache busting
  urlObj.searchParams.set('t', Date.now().toString());
  // Force no-cache for exam images
  urlObj.searchParams.set('nc', '1');
  return urlObj.toString();
};

export function ImageDisplay({
  images,
  className,
  imageSetId,
  isExamImage = false,
  isCompleted = false,
  onComplete,
  layout = 'single',
}: ImageDisplayProps) {
  const [, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [hasViewed, setHasViewed] = useState(false);

  const handleImageLoad = (index: number) => {
    setLoadingStates((prev) => ({ ...prev, [index]: false }));
    if (!hasViewed) {
      setHasViewed(true);
      if (isExamImage && !isCompleted && onComplete) {
        onComplete();
      }
    }
  };

  const handleImageError = (index: number) => {
    setLoadingStates((prev) => ({ ...prev, [index]: false }));
    setErrorStates((prev) => ({ ...prev, [index]: true }));
  };

  const handleImageClick = (index: number) => {
    setSelectedImage(selectedImage === index ? null : index);
  };

  if (!images || images.length === 0) {
    return (
      <div className={cn('bg-muted rounded-lg p-4', className)}>
        <div className="text-destructive text-sm">No images to display</div>
      </div>
    );
  }

  const getLayoutClasses = () => {
    switch (layout) {
      case 'side-by-side':
        return 'grid grid-cols-1 md:grid-cols-2 gap-4';
      case 'stacked':
        return 'flex flex-col gap-4';
      case 'single':
      default:
        return 'flex flex-col gap-4';
    }
  };

  return (
    <div
      className={cn(
        'bg-card rounded-lg p-4 space-y-4',
        {
          'ring-2 ring-primary/20': isExamImage && selectedImage !== null,
          'ring-2 ring-green-500/20': isExamImage && isCompleted,
        },
        className,
      )}
      data-image-set-id={imageSetId}
    >
      {/* Header with Image Info */}
      {/* <div className="flex items-center justify-between">
        <div className="space-y-1">
          {title && (
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <ImageIcon className="size-4" />
              {title}
              {isExamImage && isCompleted && (
                <CheckCircle className="size-4 text-green-500" />
              )}
            </h4>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {subsection && (
            <p className="text-xs text-muted-foreground">
              Section: {subsection}
            </p>
          )}
          {imageSetId && (
            <p className="text-xs text-muted-foreground">ID: {imageSetId}</p>
          )}
        </div>

        {isExamImage && (
          <div className="flex items-center gap-1">
            {isCompleted ? (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                Viewed
              </span>
            ) : hasViewed ? (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                Displayed
              </span>
            ) : (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                Not viewed
              </span>
            )}
          </div>
        )}
      </div> */}

      {/* Images */}
      <div className={getLayoutClasses()}>
        {images.map((image, index) => {
          // Add cache-busting for exam images or when explicitly needed
          const imageUrl = isExamImage ? addCacheBusting(image.url) : image.url;

          return (
            <div key={`image-${index}-${image.url}`} className="space-y-2">
              <button
                type="button"
                className={cn(
                  'relative group cursor-pointer overflow-hidden rounded-md border w-full',
                  {
                    'ring-2 ring-primary': selectedImage === index,
                  },
                )}
                onClick={() => handleImageClick(index)}
              >
                {/* {loadingStates[index] && (
                  <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
                    <ImageIcon className="size-8 text-muted-foreground" />
                  </div>
                )} */}

                {errorStates[index] ? (
                  <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="size-8 mx-auto mb-2" />
                      <p className="text-xs">Failed to load image</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={imageUrl}
                      alt={image.alt}
                      fill
                      className={cn(
                        'object-contain transition-transform duration-200',
                        {
                          'scale-105': selectedImage === index,
                        },
                      )}
                      onLoad={() => handleImageLoad(index)}
                      onError={() => handleImageError(index)}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      // Disable Next.js image optimization cache for exam images
                      unoptimized={isExamImage}
                    />

                    {/* Overlay with zoom icon */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {selectedImage === index ? (
                          <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                            <Eye className="size-4 mr-1" />
                            Viewing
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                            <ZoomIn className="size-4 mr-1" />
                            Click to view
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Image count and layout info */}
      <div className="text-center items-center text-xs text-muted-foreground">
        <span>
          {images.length} image{images.length > 1 ? 's' : ''}
          {layout !== 'single' && ` • ${layout} layout`}
        </span>
        {selectedImage !== null && (
          <span>
            Viewing image {selectedImage + 1} of {images.length}
          </span>
        )}
      </div>
    </div>
  );
}
