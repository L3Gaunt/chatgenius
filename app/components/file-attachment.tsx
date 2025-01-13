import { FileIcon, X } from 'lucide-react'
import { Button } from "@/components/ui/button"

interface FileAttachmentProps {
  file: File;
  onRemove: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getFileExtension = (filename: string): string => {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()?.toUpperCase() || 'FILE' : 'FILE'
}

const getFileType = (file: File): string => {
  if (!file.type) {
    return getFileExtension(file.name)
  }
  const [category, subtype] = file.type.split('/')
  if (category === 'application') {
    return getFileExtension(file.name)
  }
  return subtype.toUpperCase()
}

export function FileAttachment({ file, onRemove }: FileAttachmentProps) {
  return (
    <div className="flex items-center bg-gray-100 p-2 rounded-md">
      <FileIcon size={20} className="mr-2" />
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">{file.name}</span>
        <span className="text-xs text-gray-500">
          {formatFileSize(file.size)} • {getFileType(file)}
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove} className="ml-2">
        <X size={16} />
      </Button>
    </div>
  )
}

