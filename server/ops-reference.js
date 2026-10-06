// Reference text for the word_edit tool. Claude reads this as part of the tool
// description, so keep it precise. It is shared verbatim with the app's ops engine.
export const OPS_REFERENCE = `Operations (i / after are block numbers; "after":-1 means at the very start):
{"op":"replace","i":3,"html":"new content of block 3"}
{"op":"insert","after":3,"tag":"p","html":"..."}  tag = p | h1 | h2 | h3 | li ; for li add "list":"bullet" or "number" to start a new list
{"op":"insert","after":3,"blocks":[{"tag":"h1","html":"Title"},{"tag":"p","html":"Text"}]}  several blocks at once, in order
{"op":"delete","i":3}   (i may be an array)
{"op":"format","i":[3,4],"align":"left|center|right|justify","left":1.27,"first":1.27,"before":0,"after":6,"line":1.5,"tag":"p|h1|h2|h3","font":"TH Sarabun New","size":16,"color":"#000000","bold":true,"italic":false,"underline":false}  (every key except i optional; "i":"all" = every block; left/first in cm, first negative = hanging indent; before/after/size in pt)
{"op":"table","after":3,"rows":[["Name","Qty"],["Pen","2"]]}  first row is the header
{"op":"find_replace","find":"old","with":"new"}  every occurrence
{"op":"pagebreak","after":3}
{"op":"page","size":"A4|A5|A3|B5|Letter|Legal","orientation":"portrait|landscape","margins":{"top":2.54,"right":2.54,"bottom":2.54,"left":2.54}}  margins in cm, all keys optional
{"op":"header_footer","header":"text","footer":"text","page_number":"none|tl|tc|tr|bl|bc|br","format":"หน้า {n} / {N}"}  all keys optional
{"op":"title","text":"Document name"}
"html" may contain only <b> <i> <u> <s> <br> and <a href>; escape literal & < > as &amp; &lt; &gt;. One block per paragraph. Fonts: TH Sarabun New, TH SarabunPSK, Sarabun, Prompt, Kanit, Mitr, Niramit, K2D, Krub, KoHo, Kodchasan, Bai Jamjuree, Chakra Petch, Athiti, Mali, Pridi, Taviraj, Trirong, Maitree, Noto Sans Thai, Noto Serif Thai, Anuphan, IBM Plex Sans Thai, Charmonman, Srisakdi, Fahkwang, Thasadith, Itim, Chonburi, Pattaya, Sriracha, Roboto, Open Sans, Lato, Montserrat, Poppins, Merriweather, Playfair Display, Lora, Source Serif 4, Inconsolata, Caveat, Dancing Script, Arial, Times New Roman, Georgia, Courier New, Tahoma, Verdana.`;
