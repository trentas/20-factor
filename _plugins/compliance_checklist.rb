require 'digest'

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

      factor_paths = {}
      item_ids = []

      collection.docs.each do |doc|
        num = doc.data['importance']
        fail!(doc, "front matter needs an integer 'importance' (the factor number)") unless num.is_a?(Integer)
        fail!(doc, "factor number #{num} is already used by #{factor_paths[num]}") if factor_paths[num]
        factor_paths[num] = doc.relative_path

        tier_num, tier_slug = parse_category(doc.data['category'])
        fail!(doc, "category must look like 'Tier N: Name'") unless tier_slug

        items = extract_checklist(doc.content)
        fail!(doc, "no '## Compliance Checklist' section with '- [ ]' items") if items.empty?

        entries = items.map { |text| { 'id' => item_id(num, text), 'text' => text } }
        duplicate = entries.group_by { |e| e['id'] }.find { |_, group| group.size > 1 }
        fail!(doc, "checklist item appears twice: #{duplicate.last.first['text']}") if duplicate
        item_ids.concat(entries.map { |e| e['id'] })

        doc.data['compliance_items'] = items
        doc.data['compliance_entries'] = entries
        doc.data['factor_name'] = extract_factor_name(doc.data['title'])
        doc.data['tier_num'] = tier_num
        doc.data['tier_slug'] = tier_slug
      end

      site.data['checklist_catalog'] = {
        'version' => Digest::SHA256.hexdigest(item_ids.sort.join("\n"))[0, 16],
        'items' => item_ids.size
      }
    end

    private

    # An item's ID comes from its factor and its exact wording (whitespace-normalized).
    # Rewording an item gives it a new ID, so the assessment asks people to reconfirm
    # answers recorded against the old wording instead of silently carrying them over.
    def item_id(factor_num, text)
      Digest::SHA256.hexdigest("#{factor_num}\n#{text.strip.gsub(/\s+/, ' ')}")[0, 16]
    end

    # A factor without a checklist would silently drop out of the assessment, so the
    # build fails instead.
    def fail!(doc, message)
      raise Jekyll::Errors::FatalException, "#{doc.relative_path}: #{message}"
    end

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
