import { FileIcon, X } from 'lucide-react'
import { Button } from "@/components/ui/button"

interface FileAttachmentProps {
  file: File;
  onRemove: () => void;
}

export function FileAttachment({ file, onRemove }: FileAttachmentProps) {
  return (
    <div className="flex items-center bg-gray-100 p-2 rounded-md">
      <FileIcon size={20} className="mr-2" />
      <span className="text-sm truncate">{file.name}</span>
      <Button variant="ghost" size="sm" onClick={onRemove} className="ml-auto">
        <X size={16} />
      </Button>
    </div>
  )
}

