module Jekyll
  class ComplianceChecklistGenerator < Generator
    safe true
    priority :high

    CHECKLIST_HEADING = /^##\s+Compliance Checklist\s*$/
    NEXT_HEADING = /^##\s+/
    CHECKLIST_ITEM = /^-\s+\[[x\s]\]\s+(.+?)\s*$/i
    TITLE_PATTERN = /^\d+\.\s+(.+)$/
    CATEGORY_PATTERN = /^Tier\s+(\d+):\s*(.+)$/

    def generate(site)
      collection = site.collections['projects']
      return unless collection

      collection.docs.each do |doc|
        doc.data['compliance_items'] = extract_checklist(doc.content)
        doc.data['factor_name'] = extract_factor_name(doc.data['title'])
        tier_num, tier_slug = parse_category(doc.data['category'])
        doc.data['tier_num'] = tier_num if tier_num
        doc.data['tier_slug'] = tier_slug if tier_slug
      end
    end

    private

    def extract_checklist(content)
      return [] unless content
      in_section = false
      items = []
      content.each_line do |line|
        if !in_section
          in_section = true if line =~ CHECKLIST_HEADING
        else
          break if line =~ NEXT_HEADING
          if (m = line.match(CHECKLIST_ITEM))
            items << m[1]
          end
        end
      end
      items
    end

    def extract_factor_name(title)
      return nil unless title
      m = title.to_s.match(TITLE_PATTERN)
      m ? m[1] : title.to_s
    end

    def parse_category(category)
      return [nil, nil] unless category
      m = category.to_s.match(CATEGORY_PATTERN)
      return [nil, nil] unless m
      [m[1].to_i, m[2].downcase.strip]
    end
  end
end
