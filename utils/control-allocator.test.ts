/**
 * Control Allocator 測試
 */

import { describe, it, expect } from 'vitest'
import { createControlAllocator } from './control-allocator'
import type { ControlType } from '../types/game'

describe('ControlAllocator', () => {
  const allocator = createControlAllocator()

  describe('2 人模式', () => {
    it('應該為每位玩家分配完整控制', () => {
      const playerIds = ['player1', 'player2']
      const assignments = allocator.allocateControls(playerIds)

      expect(assignments).toHaveLength(2)
      
      // 檢查每位玩家都有完整控制
      const allControls: ControlType[] = ['accelerate', 'brake', 'turn_left', 'turn_right']
      assignments.forEach(assignment => {
        expect(assignment.controls).toHaveLength(4)
        expect(assignment.controls.sort()).toEqual(allControls.sort())
      })
    })

    it('應該分配到不同的隊伍', () => {
      const playerIds = ['player1', 'player2']
      const assignments = allocator.allocateControls(playerIds)

      const teamIds = assignments.map(a => a.teamId)
      expect(teamIds).toContain(1)
      expect(teamIds).toContain(2)
      expect(new Set(teamIds).size).toBe(2)
    })

    it('應該包含所有玩家', () => {
      const playerIds = ['player1', 'player2']
      const assignments = allocator.allocateControls(playerIds)

      const assignedPlayerIds = assignments.map(a => a.playerId)
      expect(assignedPlayerIds).toContain('player1')
      expect(assignedPlayerIds).toContain('player2')
    })
  })

  describe('4 人模式', () => {
    it('應該分配 2 隊，每隊 2 人', () => {
      const playerIds = ['player1', 'player2', 'player3', 'player4']
      const assignments = allocator.allocateControls(playerIds)

      expect(assignments).toHaveLength(4)

      const team1 = assignments.filter(a => a.teamId === 1)
      const team2 = assignments.filter(a => a.teamId === 2)

      expect(team1).toHaveLength(2)
      expect(team2).toHaveLength(2)
    })

    it('每隊應該有一人控制油門煞車，一人控制方向', () => {
      const playerIds = ['player1', 'player2', 'player3', 'player4']
      const assignments = allocator.allocateControls(playerIds)

      const team1 = assignments.filter(a => a.teamId === 1)
      const team2 = assignments.filter(a => a.teamId === 2)

      // 檢查隊伍 1
      const team1Controls = team1.flatMap(a => a.controls).sort()
      expect(team1Controls).toEqual(['accelerate', 'brake', 'turn_left', 'turn_right'].sort())

      // 檢查隊伍 2
      const team2Controls = team2.flatMap(a => a.controls).sort()
      expect(team2Controls).toEqual(['accelerate', 'brake', 'turn_left', 'turn_right'].sort())
    })

    it('應該包含所有玩家', () => {
      const playerIds = ['player1', 'player2', 'player3', 'player4']
      const assignments = allocator.allocateControls(playerIds)

      const assignedPlayerIds = assignments.map(a => a.playerId)
      playerIds.forEach(id => {
        expect(assignedPlayerIds).toContain(id)
      })
    })
  })

  describe('6 人模式', () => {
    it('應該分配 2 隊，每隊 3 人', () => {
      const playerIds = ['player1', 'player2', 'player3', 'player4', 'player5', 'player6']
      const assignments = allocator.allocateControls(playerIds)

      expect(assignments).toHaveLength(6)

      const team1 = assignments.filter(a => a.teamId === 1)
      const team2 = assignments.filter(a => a.teamId === 2)

      expect(team1).toHaveLength(3)
      expect(team2).toHaveLength(3)
    })

    it('每隊應該有一人控制煞車，一人控制油門，一人控制方向', () => {
      const playerIds = ['player1', 'player2', 'player3', 'player4', 'player5', 'player6']
      const assignments = allocator.allocateControls(playerIds)

      const team1 = assignments.filter(a => a.teamId === 1)
      const team2 = assignments.filter(a => a.teamId === 2)

      // 檢查隊伍 1
      const team1Controls = team1.flatMap(a => a.controls).sort()
      expect(team1Controls).toEqual(['accelerate', 'brake', 'turn_left', 'turn_right'].sort())

      // 檢查每個控制項目只分配給一人
      const team1Brake = team1.filter(a => a.controls.includes('brake'))
      const team1Accelerate = team1.filter(a => a.controls.includes('accelerate'))
      const team1Turn = team1.filter(a => a.controls.includes('turn_left') || a.controls.includes('turn_right'))

      expect(team1Brake).toHaveLength(1)
      expect(team1Accelerate).toHaveLength(1)
      expect(team1Turn).toHaveLength(1)

      // 檢查隊伍 2
      const team2Controls = team2.flatMap(a => a.controls).sort()
      expect(team2Controls).toEqual(['accelerate', 'brake', 'turn_left', 'turn_right'].sort())

      const team2Brake = team2.filter(a => a.controls.includes('brake'))
      const team2Accelerate = team2.filter(a => a.controls.includes('accelerate'))
      const team2Turn = team2.filter(a => a.controls.includes('turn_left') || a.controls.includes('turn_right'))

      expect(team2Brake).toHaveLength(1)
      expect(team2Accelerate).toHaveLength(1)
      expect(team2Turn).toHaveLength(1)
    })

    it('應該包含所有玩家', () => {
      const playerIds = ['player1', 'player2', 'player3', 'player4', 'player5', 'player6']
      const assignments = allocator.allocateControls(playerIds)

      const assignedPlayerIds = assignments.map(a => a.playerId)
      playerIds.forEach(id => {
        expect(assignedPlayerIds).toContain(id)
      })
    })
  })

  describe('getPlayerControls', () => {
    it('應該返回玩家的控制項目', () => {
      const playerIds = ['player1', 'player2']
      const assignments = allocator.allocateControls(playerIds)

      const player1Controls = allocator.getPlayerControls('player1', assignments)
      expect(player1Controls).toHaveLength(4)
    })

    it('當玩家不存在時應該返回空陣列', () => {
      const playerIds = ['player1', 'player2']
      const assignments = allocator.allocateControls(playerIds)

      const controls = allocator.getPlayerControls('nonexistent', assignments)
      expect(controls).toEqual([])
    })
  })

  describe('隨機分配', () => {
    it('多次分配應該產生不同的結果（測試隨機性）', () => {
      const playerIds = ['player1', 'player2', 'player3', 'player4']
      
      const results = new Set<string>()
      for (let i = 0; i < 10; i++) {
        const assignments = allocator.allocateControls(playerIds)
        // 將分配結果序列化為字串
        const serialized = JSON.stringify(assignments.map(a => ({
          playerId: a.playerId,
          teamId: a.teamId,
          controls: a.controls.sort()
        })))
        results.add(serialized)
      }

      // 至少應該有 2 種不同的分配結果
      expect(results.size).toBeGreaterThanOrEqual(2)
    })
  })

  describe('錯誤處理', () => {
    it('不支援的玩家人數應該拋出錯誤', () => {
      const playerIds = ['player1', 'player2', 'player3']
      expect(() => allocator.allocateControls(playerIds)).toThrow('Unsupported player count: 3')
    })
  })
})
