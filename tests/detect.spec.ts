import { describe, it, expect } from 'vitest'
import { findOpenTrigger, replaceTrigger, stripTrailingBrackets } from '../src/client/detect.ts'

describe('findOpenTrigger', () => {
  it('detects an unclosed [[ at draft end', () => {
    expect(findOpenTrigger('[[曼谷美食')).toEqual({ start: 0, query: '曼谷美食', fullwidth: false })
  })
  it('detects an unclosed [[ mid-draft with trailing text', () => {
    expect(findOpenTrigger('先写点 [[曼')).toEqual({ start: 4, query: '曼', fullwidth: false })
  })
  it('ignores a closed [[…]] pair and finds a later open one', () => {
    expect(findOpenTrigger('[[A]] 再写 [[曼')).toEqual({ start: 9, query: '曼', fullwidth: false })
  })
  it('returns null when nothing is open', () => {
    expect(findOpenTrigger('普通文本')).toBeNull()
    expect(findOpenTrigger('[[A]]')).toBeNull()
  })
  it('treats fullwidth 【【 as an open trigger', () => {
    expect(findOpenTrigger('【【曼谷美食')).toEqual({ start: 0, query: '曼谷美食', fullwidth: true })
  })
  it('keeps whitespace in the query', () => {
    expect(findOpenTrigger('[[曼谷 美食')).toEqual({ start: 0, query: '曼谷 美食', fullwidth: false })
  })
  it('handles a query containing a ] inside the open token', () => {
    expect(findOpenTrigger('[[a]b')).toEqual({ start: 0, query: 'a]b', fullwidth: false })
  })
})

describe('replaceTrigger', () => {
  it('replaces the open token with a closed wikilink', () => {
    expect(replaceTrigger('先写点 [[曼', 4, '曼谷美食')).toBe('先写点 [[曼谷美食]]')
  })
  it('replaces a fullwidth open token with a halfwidth closed wikilink', () => {
    expect(replaceTrigger('【【曼谷美食', 0, '曼谷美食')).toBe('[[曼谷美食]]')
  })
})

describe('stripTrailingBrackets', () => {
  it('strips trailing ] from a query', () => {
    expect(stripTrailingBrackets('曼谷]]')).toBe('曼谷')
    expect(stripTrailingBrackets('曼谷')).toBe('曼谷')
    expect(stripTrailingBrackets('')).toBe('')
  })
})
