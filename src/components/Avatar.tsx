import React, { useState } from 'react';

interface Props {
  src?: string;
  name: string;
  /** Classes for the photo. */
  className: string;
  /** Classes for the initial shown when there is no photo or it fails to load. */
  fallbackClassName: string;
  alt?: string;
}

/** Profile photo that falls back to the person's initial instead of a broken-image icon. */
export const Avatar: React.FC<Props> = ({ src, name, className, fallbackClassName, alt = '' }) => {
  const [failed, setFailed] = useState<string | undefined>();
  if (!src || failed === src) {
    return (
      <div className={fallbackClassName} aria-hidden={!alt}>
        {name.trim().slice(0, 1) || '؟'}
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(src)} loading="lazy" />;
};
