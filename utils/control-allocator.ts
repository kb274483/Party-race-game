/**
 * Control Allocator
 * 根據玩家人數分配控制項目
 */

import type { ControlType, ControlAssignment } from "~~/types/game";

export class ControlAllocator {
  /**
   * 分配控制項目
   * @param playerIds 玩家 ID 列表
   * @returns 控制分配結果
   */
  allocateControls(playerIds: string[]): ControlAssignment[] {
    const playerCount = playerIds.length;

    switch (playerCount) {
      case 1:
        return this.allocate1Player(playerIds);
      case 2:
        return this.allocate2Players(playerIds);
      case 3:
        return this.allocate3Players(playerIds);
      case 4:
        return this.allocate4Players(playerIds);
      case 5:
        return this.allocate5Players(playerIds);
      case 6:
        return this.allocate6Players(playerIds);
      default:
        throw new Error(`Unsupported player count: ${playerCount}`);
    }
  }

  /**
   * 1 人模式：玩家控制所有項目
   */
  private allocate1Player(playerIds: string[]): ControlAssignment[] {
    return [
      {
        playerId: playerIds[0]!,
        teamId: 1,
        controls: [
          "accelerate" as ControlType,
          "brake" as ControlType,
          "turn_left" as ControlType,
          "turn_right" as ControlType,
        ],
      },
    ];
  }

  /**
   * 2 人模式：每人獨立控制一輛車
   */
  private allocate2Players(playerIds: string[]): ControlAssignment[] {
    return playerIds.map((playerId, index) => ({
      playerId,
      teamId: index + 1,
      controls: [
        "accelerate" as ControlType,
        "brake" as ControlType,
        "turn_left" as ControlType,
        "turn_right" as ControlType,
      ],
    }));
  }

  /**
   * 3 人模式：隊伍 1 有 2 人（油門+煞車、轉向），隊伍 2 有 1 人（全控）
   */
  private allocate3Players(playerIds: string[]): ControlAssignment[] {
    return [
      {
        playerId: playerIds[0]!,
        teamId: 1,
        controls: ["accelerate" as ControlType, "brake" as ControlType],
      },
      {
        playerId: playerIds[1]!,
        teamId: 1,
        controls: ["turn_left" as ControlType, "turn_right" as ControlType],
      },
      {
        playerId: playerIds[2]!,
        teamId: 2,
        controls: [
          "accelerate" as ControlType,
          "brake" as ControlType,
          "turn_left" as ControlType,
          "turn_right" as ControlType,
        ],
      },
    ];
  }

  /**
   * 4 人模式：2 隊，每隊 2 人
   * 一人控制煞車和油門，另一人控制方向
   */
  private allocate4Players(playerIds: string[]): ControlAssignment[] {
    return [
      {
        playerId: playerIds[0]!,
        teamId: 1,
        controls: ["accelerate" as ControlType, "brake" as ControlType],
      },
      {
        playerId: playerIds[1]!,
        teamId: 1,
        controls: ["turn_left" as ControlType, "turn_right" as ControlType],
      },
      {
        playerId: playerIds[2]!,
        teamId: 2,
        controls: ["accelerate" as ControlType, "brake" as ControlType],
      },
      {
        playerId: playerIds[3]!,
        teamId: 2,
        controls: ["turn_left" as ControlType, "turn_right" as ControlType],
      },
    ];
  }

  /**
   * 5 人模式：隊伍 1 有 3 人，隊伍 2 有 2 人
   */
  private allocate5Players(playerIds: string[]): ControlAssignment[] {
    return [
      {
        playerId: playerIds[0]!,
        teamId: 1,
        controls: ["brake" as ControlType],
      },
      {
        playerId: playerIds[1]!,
        teamId: 1,
        controls: ["accelerate" as ControlType],
      },
      {
        playerId: playerIds[2]!,
        teamId: 1,
        controls: ["turn_left" as ControlType, "turn_right" as ControlType],
      },
      {
        playerId: playerIds[3]!,
        teamId: 2,
        controls: ["accelerate" as ControlType, "brake" as ControlType],
      },
      {
        playerId: playerIds[4]!,
        teamId: 2,
        controls: ["turn_left" as ControlType, "turn_right" as ControlType],
      },
    ];
  }

  /**
   * 6 人模式：2 隊，每隊 3 人
   * 一人控制煞車，一人控制油門，一人控制方向
   */
  private allocate6Players(playerIds: string[]): ControlAssignment[] {
    return [
      {
        playerId: playerIds[0]!,
        teamId: 1,
        controls: ["brake" as ControlType],
      },
      {
        playerId: playerIds[1]!,
        teamId: 1,
        controls: ["accelerate" as ControlType],
      },
      {
        playerId: playerIds[2]!,
        teamId: 1,
        controls: ["turn_left" as ControlType, "turn_right" as ControlType],
      },
      {
        playerId: playerIds[3]!,
        teamId: 2,
        controls: ["brake" as ControlType],
      },
      {
        playerId: playerIds[4]!,
        teamId: 2,
        controls: ["accelerate" as ControlType],
      },
      {
        playerId: playerIds[5]!,
        teamId: 2,
        controls: ["turn_left" as ControlType, "turn_right" as ControlType],
      },
    ];
  }
}
