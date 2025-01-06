# 这是一个特殊的导入语句，让我们可以使用List（列表）这个工具
from typing import List

# 想象一下，我们要玩一个游戏，需要按照特定的路线走过一个方格棋盘
class Solution:
    def findDiagonalOrder(self, mat: List[List[int]]) -> List[int]:
        """
        想象一个方格棋盘，我们要按照斜着走的方式，把所有格子里的数字收集起来！
        比如这样的棋盘：
        1  2  3
        4  5  6
        7  8  9
        我们要按这样的路线走：1 -> 2 -> 4 -> 7 -> 5 -> 3 -> 6 -> 8 -> 9
        就像小蛇走路一样，一会儿向右上，一会儿向左下
        """
        
        # 首先检查一下棋盘是不是空的，如果是空的就直接返回空列表
        # 就像检查游戏盒子里有没有玩具，如果没有，我们就不用玩了
        if not mat or not mat[0]:
            return []
        
        # 数一数这个棋盘有多少行(m)和多少列(n)
        # 就像数一数你的积木有多长多宽
        m, n = len(mat), len(mat[0])
        
        # 创建一个空盒子(result)，用来装我们收集到的数字
        result = []
        
        # row和col就像是我们的小人在棋盘上的位置
        # row是第几行（从上往下数），col是第几列（从左往右数）
        row = col = 0
        
        # 我们要走遍所有的格子，一共有 m × n 个格子要走
        # 就像要吃掉所有的糖果，一个都不能漏
        for _ in range(m * n):
            # 把当前格子里的数字放进我们的result盒子里
            result.append(mat[row][col])
            
            # 现在要决定下一步往哪里走
            # 如果row+col是偶数（比如0、2、4这样的数），我们就往右上方走
            # 如果是奇数（比如1、3、5这样的数），我们就往左下方走
            if (row + col) % 2 == 0:  # 这是往右上方走的情况
                if col == n - 1:       # 如果已经到最右边了
                    row += 1           # 就只能往下走一步
                elif row == 0:         # 如果已经到最上边了
                    col += 1           # 就只能往右走一步
                else:                  # 如果既没到最右也没到最上
                    row -= 1           # 就可以往右上方走（行数减1，列数加1）
                    col += 1
            else:                      # 这是往左下方走的情况
                if row == m - 1:       # 如果已经到最下边了
                    col += 1           # 就只能往右走一步
                elif col == 0:         # 如果已经到最左边了
                    row += 1           # 就只能往下走一步
                else:                  # 如果既没到最下也没到最左
                    row += 1           # 就可以往左下方走（行数加1，列数减1）
                    col -= 1
        
        # 最后把收集到的所有数字返回出去
        return result

# 下面是测试我们的游戏是否正确的代码
if __name__ == "__main__":
    # 创建一个3×3的棋盘作为例子
    matrix = [
        [1, 2, 3],  # 第一行的数字
        [4, 5, 6],  # 第二行的数字
        [7, 8, 9]   # 第三行的数字
    ]
    # 开始玩游戏！
    solution = Solution()
    result = solution.findDiagonalOrder(matrix)
    print(f"我们的棋盘长这样: {matrix}")
    print(f"按照斜着走的方式，我们收集到的数字是: {result}")  # 应该得到：[1,2,4,7,5,3,6,8,9]
