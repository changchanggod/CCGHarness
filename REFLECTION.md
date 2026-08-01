# 前言

**缺陷**:可能由于我对Harness的运用还不大熟练，也可能由于AI个别能力不足，AI对using-git-worktrees要求理解有误，未按模块分类worktrees文件夹，创建git feature分支。后经人工干预提醒修正

# 作用

**评判标准**:由于课程的经费有限，仅支持进行一次完整Harness构建与完善，所以未进行消融实验，各技能的作用大小均为在本次Harness运行的主观感受

**brainstorming**:作用最大的一部分。不仅有助于让AI更好地理解我的需求，也为后续所有项目开发奠定了基础。

**writing-plans**:有较大作用。让AI一口气写完一个Harness，无论是AI能力还是输出上下文都是不可能的。但通过**writing-plans**实现分步依次进行，使得构建较大型项目成为可能。输出的plan也使得subagent-driven-development成为可能。

**using-git-worktrees**:认为“形式大于实质”。正如[前言](#前言)的缺陷所言，该阶段的执行不尽如人意，但最终代码仍能正常运行，构建过程也十分顺利。不过，该阶段的主要目的为使修改可控，构建清晰的工作树，但该项目构建十分顺利，削弱了其作用，

**subagent-driven-development**:有较大作用。子智能体可以分担主智能体的工作，一方面可以使主智能体的上下文更干净一些，只有子智能体的完成报告，另一方面使并行化成为可能

**test-driven-development**:认为“形式大于实质”。
原因:
1. 哪怕应用了TTD，AI写出来的代码仍有不少bug
2. AI写出来的测试用例往往较为浅层，简单
3. 我未提供测试APIkey，AI也未索要APIkey而是用mock LLM，从根本上导致测试用例与真实场景存在差距。
4. 可能在subagent-driven-development阶段有帮助AI修正代码错误，但由于较透明的执行过程导致不太明显，未显示出其重要性。
*本次项目的test为AI设计，一方面是因为本次项目核心是AIForSE，另一方面我认为强制让AI去满足人类写出的复杂test会很困难。*

**requesting-code-review**:认为“形式大于实质”。


