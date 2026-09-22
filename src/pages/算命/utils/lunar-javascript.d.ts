declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getYear(): number
    getMonth(): number
    getDay(): number
    getLunar(): Lunar
  }

  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar
    getYear(): number
    getMonth(): number
    getDay(): number
    getSolar(): Solar
  }

  export class LunarMonth {
    getMonth(): number
    getDayCount(): number
  }

  export class LunarYear {
    static fromYear(year: number): LunarYear
    getMonthsInYear(): LunarMonth[]
  }
}
