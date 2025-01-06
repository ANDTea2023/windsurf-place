import PyPDF2
import re
import os
import sys
from collections import defaultdict
from typing import Generator, List, Dict, Set
import jieba
from difflib import SequenceMatcher

def check_file_exists(file_path: str) -> bool:
    """检查文件是否存在"""
    if not os.path.exists(file_path):
        print(f"错误: 文件 '{file_path}' 不存在!")
        return False
    return True

def extract_text_from_pdf(pdf_path: str) -> str:
    """从PDF文件中提取文本内容"""
    if not check_file_exists(pdf_path):
        raise FileNotFoundError(f"文件 '{pdf_path}' 不存在")

    text = []
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            total_pages = len(pdf_reader.pages)
            print(f"正在处理 {pdf_path}...")
            print(f"总页数: {total_pages}")
            
            for i, page in enumerate(pdf_reader.pages):
                if i % 10 == 0:
                    print(f"已处理 {i}/{total_pages} 页...")
                try:
                    page_text = page.extract_text()
                    if page_text.strip():
                        text.append(page_text)
                except Exception as e:
                    print(f"警告: 第 {i+1} 页文本提取失败: {str(e)}")
            print(f"{pdf_path} 处理完成")
    except Exception as e:
        error_msg = f"读取PDF文件 '{pdf_path}' 时出错: {str(e)}"
        print(error_msg, file=sys.stderr)
        raise RuntimeError(error_msg)
    
    return "\n".join(text)

def normalize_text(text: str) -> str:
    """标准化文本，去除格式差异"""
    # 统一空白字符
    text = re.sub(r'\s+', ' ', text)
    # 统一标点符号
    text = re.sub(r'[,，]', '，', text)
    text = re.sub(r'[.。]', '。', text)
    text = re.sub(r'[;；]', '；', text)
    text = re.sub(r'[:\：]', '：', text)
    # 去除特殊字符和格式标记
    text = re.sub(r'[^\w\s\u4e00-\u9fff。，；：！？""''（）《》]', '', text)
    return text.strip()

def get_key_sentences(text: str) -> List[str]:
    """提取关键句子"""
    # 按句号分割文本
    sentences = re.split(r'[。！？]', text)
    # 过滤空句子和太短的句子
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    return sentences

def split_by_sections(text: str) -> Dict[str, str]:
    """将文本按章节分割"""
    sections = defaultdict(str)
    current_section = "其他"
    
    # 定义章节标题的正则表达式模式
    section_pattern = r'\d+[\s\.]+(范围|规范性引用文件|术语和定义|分类|技术要求|试验方法|检验规则|标志[、和]包装[、和]运输[和]?贮存)'
    
    # 分块处理
    lines = text.split('\n')
    for line in lines:
        match = re.search(section_pattern, line)
        if match:
            current_section = match.group(1)
        sections[current_section] += line + '\n'
    
    return sections

def calculate_similarity(text1: str, text2: str) -> float:
    """计算两段文本的相似度"""
    return SequenceMatcher(None, text1, text2).ratio()

def extract_main_points(text: str) -> List[str]:
    """提取文本的主要观点"""
    # 分词
    words = list(jieba.cut(text))
    # 去除停用词和无意义词
    stopwords = {'的', '了', '和', '与', '或', '及', '等', '中', '在', '对', '上', '下'}
    words = [w for w in words if w not in stopwords and len(w.strip()) > 1]
    # 合并相邻词形成短语
    phrases = []
    i = 0
    while i < len(words) - 1:
        if len(words[i] + words[i+1]) <= 8:  # 控制短语长度
            phrases.append(words[i] + words[i+1])
            i += 2
        else:
            phrases.append(words[i])
            i += 1
    if i < len(words):
        phrases.append(words[i])
    return phrases

def compare_sections(sections_2015: Dict[str, str], sections_2024: Dict[str, str]) -> Dict[str, List[str]]:
    """比较两个版本的章节内容，找出主要差异"""
    differences = defaultdict(list)
    all_sections = sections_2015.keys() | sections_2024.keys()
    
    for section in all_sections:
        print(f"正在分析章节: {section}")
        
        text_2015 = normalize_text(sections_2015.get(section, ''))
        text_2024 = normalize_text(sections_2024.get(section, ''))
        
        # 如果章节完全相同，跳过
        if text_2015 == text_2024:
            continue
            
        # 计算整体相似度
        similarity = calculate_similarity(text_2015, text_2024)
        
        # 如果相似度很高（>90%），可能只是细微差异，跳过
        if similarity > 0.9:
            continue
            
        # 提取两个版本的主要观点
        points_2015 = extract_main_points(text_2015)
        points_2024 = extract_main_points(text_2024)
        
        # 找出新增和删除的主要观点
        removed = set(points_2015) - set(points_2024)
        added = set(points_2024) - set(points_2015)
        
        if removed:
            differences[section].append("删除的主要内容：")
            differences[section].extend([f"- {point}" for point in removed])
        
        if added:
            differences[section].append("新增的主要内容：")
            differences[section].extend([f"+ {point}" for point in added])
        
        # 如果发现了差异，添加相似度信息
        if differences[section]:
            differences[section].insert(0, f"章节相似度: {similarity:.2%}")
    
    return differences

def write_comparison_results(differences: Dict[str, List[str]], output_file: str) -> None:
    """将比较结果写入Markdown文件"""
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# GB9445-2015 与 GB9445-2024 标准对比差异分析\n\n")
            f.write("本文档列出了GB9445-2015与GB9445-2024两个版本标准之间的主要差异。\n\n")
            f.write("## 主要差异列表\n\n")
            
            if not differences:
                f.write("未发现重大差异。\n")
                return
            
            for section, changes in differences.items():
                if changes:  # 只写入有差异的章节
                    f.write(f"### {section}\n")
                    for change in changes:
                        f.write(f"{change}\n")
                    f.write("\n")
            
            print(f"结果已成功写入到 {output_file}")
    except Exception as e:
        error_msg = f"写入结果到文件 '{output_file}' 时出错: {str(e)}"
        print(error_msg, file=sys.stderr)
        raise RuntimeError(error_msg)

def main():
    try:
        # 文件路径
        pdf_2015 = "GB9445-2015.pdf"
        pdf_2024 = "GB9445-2024.pdf"
        output_file = "GB9445-2015vs2024差异分析.md"
        
        # 检查所有输入文件是否存在
        for pdf_file in [pdf_2015, pdf_2024]:
            if not check_file_exists(pdf_file):
                sys.exit(1)
        
        print("开始处理PDF文件...")
        
        # 提取文本
        text_2015 = extract_text_from_pdf(pdf_2015)
        text_2024 = extract_text_from_pdf(pdf_2024)
        
        print("正在按章节分割文本...")
        
        # 按章节分割
        sections_2015 = split_by_sections(text_2015)
        sections_2024 = split_by_sections(text_2024)
        
        print("正在分析主要差异...")
        
        # 比较差异
        differences = compare_sections(sections_2015, sections_2024)
        
        print("正在写入结果...")
        
        # 写入结果
        write_comparison_results(differences, output_file)
        
        print("分析完成！")
        
    except Exception as e:
        print(f"程序执行出错: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
