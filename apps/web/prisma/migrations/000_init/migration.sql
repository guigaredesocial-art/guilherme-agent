CREATE EXTENSION IF NOT EXISTS vector;

-- Contact
CREATE TABLE "Contact" (
  "id" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- ContactIdentity
CREATE TABLE "ContactIdentity" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContactIdentity_channel_externalId_key" ON "ContactIdentity"("channel", "externalId");
CREATE INDEX "ContactIdentity_contactId_idx" ON "ContactIdentity"("contactId");
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AgentSession
CREATE TABLE "AgentSession" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  "provider" TEXT NOT NULL DEFAULT 'anthropic',
  "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "memoryMode" TEXT NOT NULL DEFAULT 'window_20',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- AIRule
CREATE TABLE "AIRule" (
  "id" TEXT NOT NULL,
  "agentSessionId" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "mode" TEXT NOT NULL,
  "params" JSONB NOT NULL DEFAULT '{}',
  "action" TEXT NOT NULL,
  "staticReply" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIRule_agentSessionId_priority_idx" ON "AIRule"("agentSessionId", "priority");
ALTER TABLE "AIRule" ADD CONSTRAINT "AIRule_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "AgentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Conversation
CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "agentSessionId" TEXT,
  "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
  "handoffRequested" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Conversation_channel_contactId_key" ON "Conversation"("channel", "contactId");
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "AgentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Message
CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "providerMsgId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Message_providerMsgId_key" ON "Message"("providerMsgId");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RagDoc
CREATE TABLE "RagDoc" (
  "id" TEXT NOT NULL,
  "agentSessionId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RagDoc_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "RagDoc" ADD CONSTRAINT "RagDoc_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "AgentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RagChunk
CREATE TABLE "RagChunk" (
  "id" TEXT NOT NULL,
  "docId" TEXT NOT NULL,
  "ord" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL DEFAULT 'claude-embed',
  "embedding" vector(1536),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RagChunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RagChunk_docId_ord_idx" ON "RagChunk"("docId", "ord");
ALTER TABLE "RagChunk" ADD CONSTRAINT "RagChunk_docId_fkey" FOREIGN KEY ("docId") REFERENCES "RagDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Operator
CREATE TABLE "Operator" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "password" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");
