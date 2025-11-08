import { RoomServiceClient, AccessToken } from "livekit-server-sdk";
import dotenv from "dotenv";

dotenv.config();

// Initialize room service client
const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// Track active rooms
const activeRooms = new Map();

export async function createRoom(roomName, options = {}) {
  try {
    const room = await roomService.createRoom({
      name: roomName,
      emptyTimeout: options.emptyTimeout || 300, // 5 minutes
      maxParticipants: options.maxParticipants || 10,
      metadata: JSON.stringify({
        type: "frontdesk-ai",
        createdAt: new Date().toISOString(),
        ...options.metadata,
      }),
    });

    activeRooms.set(roomName, room);
    console.log(`Created room: ${roomName}`);
    return room;
  } catch (error) {
    if (error.message.includes("already exists")) {
      console.log(`Room ${roomName} already exists`);
      return await getRoomInfo(roomName);
    }
    throw error;
  }
}

export function createAccessToken(roomName, participantName, permissions = {}) {
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: participantName,
      name: participantName,
    }
  );

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: permissions.canPublish !== false,
    canSubscribe: permissions.canSubscribe !== false,
    canPublishData: permissions.canPublishData !== false,
    ...permissions,
  });

  return token.toJwt();
}

export async function getRoomInfo(roomName) {
  try {
    const rooms = await roomService.listRooms([roomName]);
    return rooms.length > 0 ? rooms[0] : null;
  } catch (error) {
    console.error("Error getting room info:", error);
    return null;
  }
}

export async function listParticipants(roomName) {
  try {
    const participants = await roomService.listParticipants(roomName);
    return participants;
  } catch (error) {
    console.error(`Error listing participants in ${roomName}:`, error);
    return [];
  }
}

export async function removeParticipant(roomName, participantSid) {
  try {
    await roomService.removeParticipant(roomName, participantSid);
    console.log(`Removed participant ${participantSid} from room ${roomName}`);
    return true;
  } catch (error) {
    console.error("Error removing participant:", error);
    return false;
  }
}

export async function deleteRoom(roomName) {
  try {
    await roomService.deleteRoom(roomName);
    activeRooms.delete(roomName);
    console.log(`Deleted room: ${roomName}`);
    return true;
  } catch (error) {
    console.error("Error deleting room:", error);
    return false;
  }
}

export async function sendDataToRoom(roomName, data, participantIds = []) {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(
      typeof data === "string" ? data : JSON.stringify(data)
    );

    await roomService.sendData(roomName, bytes, {
      destinationSids: participantIds.length > 0 ? participantIds : undefined,
    });

    console.log(`Sent data to room ${roomName}`);
    return true;
  } catch (error) {
    console.error("Error sending data to room:", error);
    return false;
  }
}

export async function muteParticipant(
  roomName,
  participantSid,
  trackSid,
  muted = true
) {
  try {
    await roomService.mutePublishedTrack(
      roomName,
      participantSid,
      trackSid,
      muted
    );
    console.log(
      `${
        muted ? "Muted" : "Unmuted"
      } participant ${participantSid} in room ${roomName}`
    );
  } catch (error) {
    console.error(`Error muting participant:`, error);
    throw error;
  }
}

export async function updateRoomMetadata(roomName, metadata) {
  try {
    await roomService.updateRoomMetadata(roomName, JSON.stringify(metadata));
    console.log(`Updated metadata for room ${roomName}`);
  } catch (error) {
    console.error(`Error updating room metadata:`, error);
    throw error;
  }
}

export async function getRoomStats(roomName) {
  try {
    const room = await getRoomInfo(roomName);
    const participants = await listParticipants(roomName);

    return {
      room: room
        ? {
            name: room.name,
            numParticipants: room.numParticipants,
            creationTime: room.creationTime,
            metadata: room.metadata ? JSON.parse(room.metadata) : null,
          }
        : null,
      participants: participants.map((p) => ({
        sid: p.sid,
        identity: p.identity,
        name: p.name,
        joinedAt: p.joinedAt,
        tracks:
          p.tracks?.map((t) => ({
            sid: t.sid,
            type: t.type,
            source: t.source,
            muted: t.muted,
          })) || [],
      })),
    };
  } catch (error) {
    console.error(`Error getting room stats:`, error);
    return null;
  }
}

export async function handleSupervisorResponse(
  roomName,
  response,
  participantSid = null
) {
  try {
    const message = {
      type: "response",
      response,
      timestamp: new Date().toISOString(),
    };

    const destinationSids = participantSid ? [participantSid] : [];
    await sendDataToRoom(roomName, JSON.stringify(message), destinationSids);

    console.log(`Sent supervisor response to room ${roomName}`);
    return message;
  } catch (error) {
    console.error(`Error sending supervisor response:`, error);
    throw error;
  }
}
