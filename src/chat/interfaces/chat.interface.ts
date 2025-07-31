export interface ChatRoom {
  id: string
  name: string
  type: "public" | "private" | "direct"
  participants: string[]
  createdAt: Date
  updatedAt: Date
}

export interface MessageReaction {
  emoji: string
  userId: string
  createdAt: Date
}

export interface MessageThread {
  parentMessageId: string
  replies: ChatMessage[]
}

export interface ChatMessage {
  id: string
  content: string
  senderId: string
  roomId: string
  type: "text" | "image" | "file" | "system"
  reactions: MessageReaction[]
  thread?: MessageThread
  isEdited: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserPresence {
  userId: string
  status: "online" | "away" | "busy" | "offline"
  lastSeen: Date
}
