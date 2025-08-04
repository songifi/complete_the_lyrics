import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

// Services
import { RoomManagementService } from '../services/room-management.service';
import { RoomModerationService } from '../services/room-moderation.service';

// DTOs
import {
  CreateRoomDto,
  JoinRoomDto,
  UpdateRoomDto,
  RoomQueryDto,
  KickUserDto,
  BanUserDto,
  MuteUserDto,
  UnbanUserDto,
  UnmuteUserDto,
} from '../dto';

// Interfaces
import { AuthenticatedRequest } from '../interfaces';

// Guards
import { RoomAccessGuard, RoomModerationGuard, RequireRoomRole } from '../guards';

// Enums
import { RoomRole } from '../enums';

@ApiTags('Room Management')
@Controller('rooms')
export class RoomManagementController {
  constructor(
    private readonly roomManagementService: RoomManagementService,
    private readonly roomModerationService: RoomModerationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid room configuration' })
  async createRoom(@Body() createRoomDto: CreateRoomDto, @Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const username = req.user.username;

    return this.roomManagementService.createRoom(createRoomDto, userId, username);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of rooms with filters and pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of rooms retrieved successfully',
  })
  async getRooms(@Query() query: RoomQueryDto) {
    return this.roomManagementService.getRooms(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room details by ID' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({
    status: 200,
    description: 'Room details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @UseGuards(RoomAccessGuard)
  async getRoomById(@Param('id') roomId: string) {
    return this.roomManagementService.getRoomById(roomId);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Successfully joined the room' })
  @ApiResponse({ status: 403, description: 'Access denied or room is full' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  @UseGuards(RoomAccessGuard)
  async joinRoom(
    @Param('id') roomId: string,
    @Body() joinRoomDto: JoinRoomDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    const username = req.user.username;

    return this.roomManagementService.joinRoom(roomId, joinRoomDto, userId, username);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 204, description: 'Successfully left the room' })
  @ApiResponse({
    status: 404,
    description: 'User is not a member of this room',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveRoom(@Param('id') roomId: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.roomManagementService.leaveRoom(roomId, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update room settings' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Room updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseGuards(RoomAccessGuard, RoomModerationGuard)
  @RequireRoomRole(RoomRole.MODERATOR)
  async updateRoom(
    @Param('id') roomId: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.roomManagementService.updateRoom(roomId, updateRoomDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete/Archive a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 204, description: 'Room deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Only room owner can delete the room',
  })
  @UseGuards(RoomAccessGuard, RoomModerationGuard)
  @RequireRoomRole(RoomRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(@Param('id') roomId: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.roomManagementService.deleteRoom(roomId, userId);
  }

  // Moderation endpoints
  @Post(':id/moderation/kick')
  @ApiOperation({ summary: 'Kick a user from the room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 204, description: 'User kicked successfully' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient moderation permissions',
  })
  @UseGuards(RoomAccessGuard, RoomModerationGuard)
  @RequireRoomRole(RoomRole.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async kickUser(
    @Param('id') roomId: string,
    @Body() kickUserDto: KickUserDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const moderatorId = req.user.id;
    const moderatorUsername = req.user.username;

    return this.roomModerationService.kickUser(roomId, kickUserDto, moderatorId, moderatorUsername);
  }

  @Post(':id/moderation/ban')
  @ApiOperation({ summary: 'Ban a user from the room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 204, description: 'User banned successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient moderation permissions' })
  @UseGuards(RoomAccessGuard, RoomModerationGuard)
  @RequireRoomRole(RoomRole.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async banUser(
    @Param('id') roomId: string,
    @Body() banUserDto: BanUserDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const moderatorId = req.user.id;
    const moderatorUsername = req.user.username;

    return this.roomModerationService.banUser(roomId, banUserDto, moderatorId, moderatorUsername);
  }

  @Post(':id/moderation/mute')
  @ApiOperation({ summary: 'Mute a user in the room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 204, description: 'User muted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient moderation permissions',
  })
  @UseGuards(RoomAccessGuard, RoomModerationGuard)
  @RequireRoomRole(RoomRole.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async muteUser(
    @Param('id') roomId: string,
    @Body() muteUserDto: MuteUserDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const moderatorId = req.user.id;
    const moderatorUsername = req.user.username;

    return this.roomModerationService.muteUser(roomId, muteUserDto, moderatorId, moderatorUsername);
  }

  @Post(':id/moderation/unban')
  @ApiOperation({ summary: 'Unban a user from the room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 204, description: 'User unbanned successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient moderation permissions' })
  @UseGuards(RoomAccessGuard, RoomModerationGuard)
  @RequireRoomRole(RoomRole.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unbanUser(
    @Param('id') roomId: string,
    @Body() unbanUserDto: UnbanUserDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const moderatorId = req.user.id;
    const moderatorUsername = req.user.username;

    return this.roomModerationService.unbanUser(
      roomId,
      unbanUserDto,
      moderatorId,
      moderatorUsername,
    );
  }

  @Post(':id/moderation/unmute')
  @ApiOperation({ summary: 'Unmute a user in the room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 204, description: 'User unmuted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient moderation permissions' })
  @UseGuards(RoomAccessGuard, RoomModerationGuard)
  @RequireRoomRole(RoomRole.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmuteUser(
    @Param('id') roomId: string,
    @Body() unmuteUserDto: UnmuteUserDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const moderatorId = req.user.id;
    const moderatorUsername = req.user.username;

    return this.roomModerationService.unmuteUser(
      roomId,
      unmuteUserDto,
      moderatorId,
      moderatorUsername,
    );
  }

  @Get(':id/moderation/history')
  @ApiOperation({ summary: 'Get moderation history for a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'Moderation history retrieved successfully',
  })
  @UseGuards(RoomAccessGuard, RoomModerationGuard)
  @RequireRoomRole(RoomRole.MODERATOR)
  async getModerationHistory(
    @Param('id') roomId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.roomModerationService.getModerationHistory(roomId, page, limit);
  }
}
